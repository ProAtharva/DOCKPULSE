import * as simulationService from '../services/simulationService.js';

/**
 * WebSocket layer:
 *
 * - Clients connect via Socket.io; they immediately receive the current `port:state` snapshot
 *   so UIs can render without waiting for the next tick.
 * - Domain events (`SHIP_*`) are produced in `simulationService` → `eventService.publishEvent`
 *   → Redis channel → `subscribeToEvents` in `server.js` → `io.emit('port:event', ...)`.
 * - Each tick may also emit `port:state` from the simulation for live tables/maps.
 *
 * Event names (client): `port:event` { type, payload, ts }, `port:state` full snapshot.
 */

/**
 * @param {import('socket.io').Server} io
 */
export function attachSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.emit('port:state', simulationService.getStateSnapshot());

    socket.on('disconnect', (reason) => {
      console.log(`[socket] client disconnected (${reason})`);
    });
  });
}
