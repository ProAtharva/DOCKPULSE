import * as eventService from './eventService.js';
import { portState } from '../state/portState.js';

/** @typedef {'free' | 'busy'} BerthStatus */

/**
 * Decision engine: berth allocation, per-berth queues, congestion scoring, API suggestions.
 *
 * Flow: `SHIP_ARRIVED` is published to Redis first; `handleShipArrivedSync` runs immediately
 * afterward (same process) so berth state stays consistent before the next `port:state` push.
 * External Redis consumers still see the same events on the bus.
 */

/**
 * Five berths: status, occupant, and a local FIFO when the quay lane is overloaded.
 */
export function initBerths() {
  portState.berths = Array.from({ length: 5 }, (_, i) => ({
    id: `Q${i + 1}`,
    status: /** @type {BerthStatus} */ ('free'),
    currentShip: null,
    queueLength: 0,
    _queue: /** @type {string[]} */ ([]),
    shipId: null,
  }));
}

/**
 * @param {{ ship: { id: string } }} payload
 * @returns {Promise<boolean>} true if state changed (caller should broadcast)
 */
export async function handleShipArrivedSync(payload) {
  const ship = portState.ships.find((s) => s.id === payload.ship?.id);
  if (!ship) return false;

  const freeBerths = portState.berths.filter((b) => b.status === 'free' && !b.currentShip);
  if (freeBerths.length > 0) {
    freeBerths.sort((a, b) => a.queueLength - b.queueLength || a.id.localeCompare(b.id));
    await assignShipToBerth(ship, freeBerths[0]);
    return true;
  }

  const target = [...portState.berths].sort(
    (a, b) => a.queueLength - b.queueLength || a.id.localeCompare(b.id),
  )[0];
  target._queue.push(ship.id);
  target.queueLength = target._queue.length;
  ship.status = 'queued';
  ship.eta = 0;
  ship.queuedAtBerthId = target.id;

  await eventService.publishEvent('QUEUE_UPDATED', {
    shipId: ship.id,
    shipName: ship.name,
    berthId: target.id,
    queueLength: target.queueLength,
    globalWaiting: countShipsQueued(),
  });
  return true;
}

async function assignShipToBerth(ship, berth) {
  berth.status = 'busy';
  berth.currentShip = ship.id;
  berth.shipId = ship.id;
  ship.status = 'berthed';
  ship.eta = 0;
  delete ship.queuedAtBerthId;
  portState.containers += Math.floor(ship.cargoLoad * 0.02);

  await eventService.publishEvent('BERTH_ASSIGNED', {
    shipId: ship.id,
    shipName: ship.name,
    berthId: berth.id,
  });
}

function countShipsQueued() {
  return portState.ships.filter((s) => s.status === 'queued').length;
}

/**
 * Stochastic “cargo completed” so queued ships can eventually berth (demo).
 * @returns {Promise<boolean>} true if anything changed
 */
export async function maybeReleaseBerthAndDrainQueues(probability = 0.02) {
  const busy = portState.berths.filter((b) => b.status === 'busy' && b.currentShip);
  if (busy.length === 0 || Math.random() > probability) {
    return await drainAnyReadySlots();
  }

  const b = busy[Math.floor(Math.random() * busy.length)];
  const sid = b.currentShip;
  portState.ships = portState.ships.filter((s) => s.id !== sid);
  b.status = 'free';
  b.currentShip = null;
  b.shipId = null;

  let changed = true;
  changed = (await drainWaitingForBerth(b)) || changed;
  for (const berth of portState.berths) {
    if (berth._queue.length > 0 && berth.status === 'free') {
      const c = await drainWaitingForBerth(berth);
      changed = c || changed;
    }
  }
  return changed;
}

/** If a berth is free and has a queue, assign next (covers backlog after other ticks). */
async function drainAnyReadySlots() {
  let changed = false;
  for (const berth of portState.berths) {
    if (berth.status === 'free' && berth._queue.length > 0) {
      const c = await drainWaitingForBerth(berth);
      changed = c || changed;
    }
  }
  return changed;
}

/**
 * @returns {Promise<boolean>}
 */
async function drainWaitingForBerth(berth) {
  let changed = false;
  while (berth.status === 'free' && berth._queue.length > 0) {
    const nextId = berth._queue.shift();
    berth.queueLength = berth._queue.length;
    const ship = portState.ships.find((s) => s.id === nextId && s.status === 'queued');
    if (!ship) continue;
    await assignShipToBerth(ship, berth);
    changed = true;
  }
  return changed;
}

export function getBerthUtilizationPercent() {
  const busy = portState.berths.filter((b) => b.status === 'busy').length;
  return (busy / portState.berths.length) * 100;
}

export function getWaitingShipCount() {
  return portState.ships.filter((s) => s.status === 'queued').length;
}

export function getCongestionScore() {
  const wait = getWaitingShipCount();
  const util = getBerthUtilizationPercent();
  const queuedAcross = portState.berths.reduce((n, b) => n + b._queue.length, 0);
  return Math.min(100, Math.round(util * 0.55 + wait * 8 + queuedAcross * 2));
}

export function getPredictedCongestion15m() {
  const base = getCongestionScore();
  const wait = getWaitingShipCount();
  const predicted = Math.min(100, Math.round(base + wait * 3 + (wait > 2 ? 15 : 0)));
  return { score: predicted, label: wait > 2 ? 'elevated' : wait > 0 ? 'moderate' : 'low' };
}

export function getApiSuggestionsPayload() {
  const congestionScore = getCongestionScore();
  const berthUtilizationPercent = Math.round(getBerthUtilizationPercent());
  const waitingShips = getWaitingShipCount();
  const pred = getPredictedCongestion15m();

  return {
    congestionScore,
    berthUtilizationPercent,
    waitingShips,
    predictedCongestion15m: pred.score,
    predictionLabel: pred.label,
    suggestions: buildSuggestions(congestionScore, waitingShips),
  };
}

function buildSuggestions(congestion, waiting) {
  /** @type {{ text: string; action: string; severity: 'info' | 'warning' | 'critical' }[]} */
  const out = [];

  const queued = portState.ships.filter((s) => s.status === 'queued');
  const approaching = portState.ships.filter(
    (s) => s.status === 'approaching' || s.status === 'en_route',
  );

  if (queued.length > 0) {
    const s = queued[0];
    out.push({
      text: `Delay incoming vessel "${s.name}" until a berth opens (queue pressure).`,
      action: `DELAY_SHIP:${s.id}`,
      severity: waiting > 2 ? 'critical' : 'warning',
    });
  }

  if (congestion > 60 && approaching.length > 0) {
    const target = [...approaching].sort((a, b) => b.eta - a.eta)[0];
    out.push({
      text: `Consider slowing "${target.name}" (ETA ${target.eta} min) to reduce peak load.`,
      action: `DELAY_SHIP:${target.id}`,
      severity: 'warning',
    });
  }

  const byQueue = [...portState.berths].sort((a, b) => a.queueLength - b.queueLength);
  const leastBusy = byQueue[0];
  const busiest = [...portState.berths].sort((a, b) => b.queueLength - a.queueLength)[0];
  if (busiest && leastBusy && busiest.queueLength - leastBusy.queueLength >= 2) {
    out.push({
      text: `Reassign next queued ship to ${leastBusy.id} (${leastBusy.queueLength} in lane vs ${busiest.queueLength} at ${busiest.id}).`,
      action: `REASSIGN_BERTH:${leastBusy.id}`,
      severity: 'info',
    });
  }

  if (out.length === 0) {
    out.push({
      text: 'Berth capacity within normal parameters. Continue monitoring.',
      action: 'MONITOR',
      severity: 'info',
    });
  }

  return out.slice(0, 5);
}

export function getDecisionSnapshot() {
  const pred = getPredictedCongestion15m();
  return {
    congestionScore: getCongestionScore(),
    berthUtilizationPercent: Math.round(getBerthUtilizationPercent()),
    waitingShips: getWaitingShipCount(),
    predictedCongestion15m: pred.score,
    predictionLabel: pred.label,
  };
}
