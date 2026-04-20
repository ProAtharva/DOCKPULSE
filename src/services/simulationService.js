import { createShip } from '../models/shipModel.js';
import * as eventService from './eventService.js';
import { portState } from '../state/portState.js';
import * as berthService from './berthService.js';

const TICK_MS = 2000;
const APPROACHING_ETA_MAX = 3;
const NEW_SHIP_PROBABILITY = 0.45;

let tickHandle = null;

function broadcastStateSnapshot(io) {
  if (io) {
    io.emit('port:state', getStateSnapshot());
  }
}

/**
 * Plain snapshot for clients (hides internal `_queue` on berths).
 */
export function getStateSnapshot() {
  return {
    ships: portState.ships.map((s) => ({ ...s })),
    berths: portState.berths.map((b) => ({
      id: b.id,
      status: b.status,
      currentShip: b.currentShip,
      queueLength: b.queueLength,
      shipId: b.shipId,
    })),
    containers: portState.containers,
    tickMs: TICK_MS,
    decision: berthService.getDecisionSnapshot(),
  };
}

/**
 * Starts the simulation loop.
 * Berths must be initialised via berthService.initBerths() before this runs.
 */
export function startSimulation(io = null) {
  if (tickHandle) return;

  const loop = () => {
    tick(io).catch((err) => {
      console.error('[simulationService] tick error:', err);
    });
  };

  loop();
  tickHandle = setInterval(loop, TICK_MS);
  console.log(`[simulationService] loop started (${TICK_MS}ms)`);
}

export function stopSimulation() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

async function tick(io) {
  await maybeSpawnShip(io);

  for (const ship of [...portState.ships]) {
    if (ship.status === 'berthed' || ship.status === 'queued') continue;

    const prevEta = ship.eta;
    ship.eta = Math.max(0, ship.eta - 1);

    if (ship.status === 'en_route' && prevEta > APPROACHING_ETA_MAX && ship.eta <= APPROACHING_ETA_MAX) {
      ship.status = 'approaching';
      await eventService.publishEvent('SHIP_APPROACHING', { ship: { ...ship } });
      broadcastStateSnapshot(io);
    }

    if (ship.status === 'approaching' && ship.eta === 0) {
      ship.status = 'arrived';
      ship.eta = 0;
      await eventService.publishEvent('SHIP_ARRIVED', {
        ship: { ...ship },
      });
      await berthService.handleShipArrivedSync({ ship });
      broadcastStateSnapshot(io);
    }
  }

  const released = await berthService.maybeReleaseBerthAndDrainQueues(0.02);
  if (released) {
    broadcastStateSnapshot(io);
  }
}

async function maybeSpawnShip(io) {
  if (Math.random() > NEW_SHIP_PROBABILITY) return;

  const ship = createShip();
  portState.ships.push(ship);

  await eventService.publishEvent('SHIP_CREATED', { ship: { ...ship } });
  broadcastStateSnapshot(io);
}
