import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env.js';
import { subscribeToEvents, disconnectRedis } from './services/eventService.js';
import * as simulationService from './services/simulationService.js';
import * as berthService from './services/berthService.js';
import { runScenario } from './services/scenarioService.js';
import { attachSocketHandlers } from './websocket/socketHandler.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());

const twinDist = path.join(__dirname, '../client/dist');
const twinIndex = path.join(twinDist, 'index.html');
if (fs.existsSync(twinIndex)) {
  app.use(express.static(twinDist));
  console.log('[server] React twin: serving client/dist');
} else {
  app.use(express.static(path.join(__dirname, '../public')));
}

const HEALTH_BODY = {
  ok: true,
  name: 'DockPulse',
  service: 'dock-pulse',
};

/**
 * Browsers send Accept: text/html; raw JSON can look "blank" with some extensions.
 * API clients (curl, fetch with json) typically omit text/html → JSON.
 */
app.get('/health', (req, res) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('text/html')) {
    const text = JSON.stringify(HEALTH_BODY, null, 2);
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DockPulse — Health</title></head>
<body style="font-family: system-ui; margin: 1.5rem; background: #f8fafc; color: #0f172a;">
  <h1 style="font-size: 1.1rem;">DockPulse</h1>
  <pre style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">${text}</pre>
</body>
</html>`);
    return;
  }
  res.json(HEALTH_BODY);
});

/**
 * Decision engine: AI-style suggestions + congestion metrics (read-only; simulation acts on its own).
 */
app.get('/api/suggestions', (_req, res) => {
  res.json(berthService.getApiSuggestionsPayload());
});

/**
 * What-if: inject ships, weather delay, or crane outage — forecast ~15 min (sandbox, does not mutate live state).
 */
app.post('/api/simulate-scenario', (req, res) => {
  try {
    res.json(runScenario(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err?.message || 'Scenario failed' });
  }
});

/**
 * Boot order:
 * 1. HTTP server + Socket.io
 * 2. Subscribe to Redis *before* simulation starts so no events are missed
 * 3. Start the 2s simulation loop (ships, berths, containers)
 */
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

attachSocketHandlers(io);

async function main() {
  berthService.initBerths();

  await subscribeToEvents((msg) => {
    /**
     * SHIP_ARRIVED already triggered berth logic synchronously in the simulation tick.
     * Redis still delivers the event for observability / extra subscribers.
     */
    io.emit('port:event', msg);
  });

  simulationService.startSimulation(io);

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] DockPulse — http://localhost:${config.port}`);
    console.log(`[server] dashboard: http://localhost:${config.port}/`);
    console.log(`[server] WebSocket ready; simulation runs without REST calls`);
  });
}

main().catch(async (err) => {
  console.error('[server] fatal:', err);
  if (err.message?.includes('ECONNREFUSED') || err.code === 'ECONNREFUSED') {
    console.error('[server] Is Redis running? Set REDIS_URL in .env (see .env.example)');
  }
  await disconnectRedis();
  process.exit(1);
});

process.on('SIGINT', async () => {
  simulationService.stopSimulation();
  await disconnectRedis();
  process.exit(0);
});
