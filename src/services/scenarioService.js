import { createShip } from '../models/shipModel.js';
import * as simulationService from './simulationService.js';

const HORIZON_MIN = 15;
const APPROACHING_ETA_MAX = 3;
const SCENARIO_MODES = ['none', 'weather', 'crane_failure'];

/**
 * Softer congestion index (0–100) so 15‑minute traces vary instead of pegging at 100.
 * Heavy weight on berth util, capped queue contribution, mild pinch when gridlocked.
 */
function virtualCongestionScore(ships, berths) {
  const active = berths.filter((b) => !b.unavailable);
  const n = Math.max(1, active.length);
  const busy = active.filter((b) => b.status === 'busy' && (b.currentShip || b.shipId)).length;
  const utilPct = (busy / n) * 100;
  const wait = ships.filter((s) => s.status === 'queued').length;
  const qAcross = berths.reduce((sum, b) => sum + (b._queue?.length || 0), 0);

  const utilScore = Math.min(56, utilPct * 0.52);
  const queueScore = Math.min(44, wait * 3.4 + qAcross * 1.15);
  const pinch =
    busy >= n - 1 && wait > 0 && active.length > 1 ? Math.min(22, 6 + wait * 1.8) : 0;

  return Math.min(100, Math.round(utilScore + queueScore + pinch));
}

function cloneBerths(snapBerths) {
  return snapBerths.map((b) => ({
    id: b.id,
    status: b.status === 'busy' ? 'busy' : 'free',
    currentShip: b.currentShip,
    queueLength: 0,
    shipId: b.shipId,
    _queue: [],
    unavailable: false,
  }));
}

function cloneShips(snapShips) {
  return snapShips.map((s) => ({ ...s }));
}

function assignVirt(ship, berth) {
  berth.status = 'busy';
  berth.currentShip = ship.id;
  berth.shipId = ship.id;
  ship.status = 'berthed';
  ship.eta = 0;
  delete ship.queuedAtBerthId;
}

function pickQueueBerth(berths) {
  const candidates = berths.filter((b) => !b.unavailable);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => a.queueLength - b.queueLength || a.id.localeCompare(b.id))[0];
}

function tryAssignArrived(ship, ships, berths) {
  const free = berths.filter((b) => b.status === 'free' && !b.currentShip && !b.unavailable);
  if (free.length > 0) {
    free.sort((a, b) => a.queueLength - b.queueLength || a.id.localeCompare(b.id));
    assignVirt(ship, free[0]);
    return;
  }
  const target = pickQueueBerth(berths);
  if (!target) {
    ship.status = 'queued';
    return;
  }
  target._queue = target._queue || [];
  target._queue.push(ship.id);
  target.queueLength = target._queue.length;
  ship.status = 'queued';
  ship.eta = 0;
  ship.queuedAtBerthId = target.id;
}

function drainQueues(ships, berths) {
  for (const berth of berths) {
    if (berth.unavailable) continue;
    while (berth.status === 'free' && berth._queue?.length) {
      const id = berth._queue.shift();
      berth.queueLength = berth._queue.length;
      const ship = ships.find((s) => s.id === id && s.status === 'queued');
      if (ship) assignVirt(ship, berth);
    }
  }
}

function maybeRelease(ships, berths, p = 0.12) {
  const busy = berths.filter((b) => b.status === 'busy' && (b.currentShip || b.shipId) && !b.unavailable);
  if (!busy.length || Math.random() > p) return;
  const b = busy[Math.floor(Math.random() * busy.length)];
  const sid = b.currentShip || b.shipId;
  const idx = ships.findIndex((s) => s.id === sid);
  if (idx >= 0) ships.splice(idx, 1);
  b.status = 'free';
  b.currentShip = null;
  b.shipId = null;
  drainQueues(ships, berths);
}

function applyCraneFailureFix(ships, berths) {
  const idx = Math.floor(Math.random() * berths.length);
  const block = berths[idx];
  const stuckId = block.currentShip || block.shipId;

  block.unavailable = true;
  block.status = 'blocked';
  block._queue = [];
  block.queueLength = 0;

  if (stuckId) {
    const ship = ships.find((s) => s.id === stuckId);
    block.currentShip = null;
    block.shipId = null;
    if (ship && ship.status === 'berthed') {
      ship.status = 'arrived';
      ship.eta = 0;
      const alt = berths.find((x) => x.id !== block.id && x.status === 'free' && !x.unavailable);
      if (alt) assignVirt(ship, alt);
      else tryAssignArrived(ship, ships, berths);
    }
  } else {
    block.currentShip = null;
    block.shipId = null;
  }
  drainQueues(ships, berths);
}

function advanceMinute(ships, berths) {
  for (const ship of ships) {
    if (ship.status === 'berthed' || ship.status === 'queued') continue;

    if (ship.status === 'en_route') {
      const prevEta = ship.eta;
      ship.eta = Math.max(0, ship.eta - 1);
      if (prevEta > APPROACHING_ETA_MAX && ship.eta <= APPROACHING_ETA_MAX) {
        ship.status = 'approaching';
      }
      if (ship.eta === 0) {
        ship.status = 'arrived';
      }
    } else if (ship.status === 'approaching') {
      ship.eta = Math.max(0, ship.eta - 1);
      if (ship.eta === 0) {
        ship.status = 'arrived';
      }
    }
  }

  for (const ship of ships.filter((s) => s.status === 'arrived')) {
    tryAssignArrived(ship, ships, berths);
  }

  drainQueues(ships, berths);
  maybeRelease(ships, berths);
}

function buildScenarioActions(ctx) {
  const out = [];
  const { disruptionType, delayFactor, numberOfShips, peak, congestionDelta, overloadRisk } = ctx;

  if (numberOfShips > 0) {
    out.push({
      text: `Stress layer: +${numberOfShips} synthetic arrival(s). Peak congestion ${peak} (${congestionDelta >= 0 ? '+' : ''}${congestionDelta} vs baseline).`,
      severity: peak > 70 ? 'warning' : 'info',
      action: 'THROTTLE_ARRIVALS',
    });
  }

  if (disruptionType === 'weather') {
    out.push({
      text: `Weather profile (delay ×${(1 + delayFactor).toFixed(2)}): stagger pilot boarding and extend slop windows.`,
      severity: 'warning',
      action: 'WEATHER_HOLD',
    });
  }

  if (disruptionType === 'crane_failure') {
    out.push({
      text: 'Crane fault: one berth face offline in model — gangs shifted; watch queue spill to neighbouring quays.',
      severity: 'critical',
      action: 'REALLOCATE_CRANE',
    });
  }

  if (overloadRisk === 'high') {
    out.push({
      text: 'High overload minutes in horizon — consider tier-2 storage and delaying non-priority SIM vessels.',
      severity: 'critical',
      action: 'ACTIVATE_TIER2',
    });
  }

  if (!out.length) {
    out.push({
      text: 'Port retains headroom for this scenario.',
      severity: 'info',
      action: 'MONITOR',
    });
  }

  return out.slice(0, 6);
}

function summarize(disruptionType, peak, overloadRisk, n) {
  return `15 min what-if (${disruptionType}${n ? `, +${n} ships` : ''}): peak ${peak}, risk ${overloadRisk}.`;
}

/**
 * Run one sandbox path from a fresh clone of `live` for a single disruption mode.
 */
function runScenarioForMode(disruptionType, numberOfShips, delayFactor, live) {
  const ships = cloneShips(live.ships);
  const berths = cloneBerths(live.berths);

  for (let i = 0; i < numberOfShips; i++) {
    ships.push(
      createShip({
        name: `SIM-${i + 1}`,
        status: 'en_route',
        eta: Math.floor(5 + Math.random() * 10),
      }),
    );
  }

  if (disruptionType === 'weather' && delayFactor > 0) {
    for (const s of ships) {
      if (s.status === 'en_route' || s.status === 'approaching') {
        s.eta = Math.max(1, Math.ceil(s.eta * (1 + delayFactor)));
      }
    }
  }

  if (disruptionType === 'crane_failure') {
    applyCraneFailureFix(ships, berths);
  }

  const baselineCongestion = virtualCongestionScore(
    cloneShips(live.ships),
    cloneBerths(live.berths),
  );

  const timeline = [];
  let peak = 0;
  let overloadMinutes = 0;

  for (let m = 1; m <= HORIZON_MIN; m++) {
    advanceMinute(ships, berths);
    const c = virtualCongestionScore(ships, berths);
    const waiting = ships.filter((s) => s.status === 'queued').length;
    const activeBerths = berths.filter((b) => !b.unavailable);
    const util =
      activeBerths.length > 0
        ? Math.round(
            (activeBerths.filter((b) => b.status === 'busy').length / activeBerths.length) * 100,
          )
        : 100;

    const overload =
      c >= 74 ||
      waiting > 5 ||
      (waiting > 2 && activeBerths.filter((b) => b.status === 'free').length === 0);

    if (overload) overloadMinutes++;
    if (c > peak) peak = c;

    timeline.push({
      minute: m,
      congestionScore: c,
      waitingShips: waiting,
      utilizationPercent: util,
      overload,
    });
  }

  const congestionDelta = peak - baselineCongestion;
  const overloadRisk =
    peak >= 88 || overloadMinutes >= 9 ? 'high' : peak >= 62 || overloadMinutes >= 5 ? 'moderate' : 'low';

  return {
    baselineCongestion,
    peakCongestion: peak,
    congestionDelta,
    berthOverloadMinutes: overloadMinutes,
    overloadRisk,
    timeline,
  };
}

/**
 * Deterministic sandbox — live `portState` is never mutated.
 * Runs all three disruption modes so the client can compare curves.
 */
export function runScenario(body) {
  const numberOfShips = Math.min(50, Math.max(0, Number(body?.numberOfShips) || 0));
  const delayFactor = Math.min(2, Math.max(0, Number(body?.delayFactor) ?? 0));
  const preferred = ['none', 'weather', 'crane_failure'].includes(body?.disruptionType)
    ? body.disruptionType
    : 'none';

  const live = simulationService.getStateSnapshot();

  const byMode = {};
  for (const mode of SCENARIO_MODES) {
    byMode[mode] = runScenarioForMode(mode, numberOfShips, delayFactor, live);
  }

  const primary = byMode[preferred] || byMode.none;

  const timelinesByMode = Object.fromEntries(
    SCENARIO_MODES.map((m) => [
      m,
      {
        timeline: byMode[m].timeline,
        peakCongestion: byMode[m].peakCongestion,
        baselineCongestion: byMode[m].baselineCongestion,
        congestionDelta: byMode[m].congestionDelta,
        berthOverloadMinutes: byMode[m].berthOverloadMinutes,
        overloadRisk: byMode[m].overloadRisk,
      },
    ]),
  );

  return {
    scenario: {
      numberOfShips,
      delayFactor,
      disruptionType: preferred,
      horizonMinutes: HORIZON_MIN,
    },
    baselineCongestion: primary.baselineCongestion,
    peakCongestion: primary.peakCongestion,
    congestionDelta: primary.congestionDelta,
    berthOverloadMinutes: primary.berthOverloadMinutes,
    overloadRisk: primary.overloadRisk,
    timeline: primary.timeline,
    timelinesByMode,
    suggestedActions: buildScenarioActions({
      disruptionType: preferred,
      delayFactor,
      numberOfShips,
      peak: primary.peakCongestion,
      congestionDelta: primary.congestionDelta,
      overloadRisk: primary.overloadRisk,
    }),
    summary: summarize(preferred, primary.peakCongestion, primary.overloadRisk, numberOfShips),
  };
}
