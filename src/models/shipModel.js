import { randomUUID } from 'crypto';

/**
 * @typedef {object} Ship
 * @property {string} id
 * @property {string} name
 * @property {number} eta — minutes until arrival at port
 * @property {number} speed
 * @property {number} cargoLoad
 * @property {'en_route' | 'approaching' | 'arrived' | 'berthed' | 'queued'} status
 */

/** Random vessel names for simulation (generic maritime). */
const NAME_PARTS = {
  prefixes: ['MV', 'SS', 'TS', 'MT'],
  areas: ['Pacific', 'Arctic', 'Baltic', 'Coral', 'Harbor', 'Coastal', 'Northern'],
  nouns: ['Trader', 'Carrier', 'Express', 'Pride', 'Wave', 'Crest', 'Star', 'Swift'],
};

/**
 * Creates a new ship record used by the simulation.
 *
 * @param {object} [overrides] — optional fields to merge
 * @returns {Ship}
 */
export function createShip(overrides = {}) {
  const id = overrides.id ?? randomUUID();
  const name =
    overrides.name ??
    `${pick(NAME_PARTS.prefixes)} ${pick(NAME_PARTS.areas)} ${pick(NAME_PARTS.nouns)}`;

  // ETA: minutes until arrival (counts down each simulation tick)
  const eta =
    overrides.eta ?? overrides.etaMinutes ?? Math.floor(4 + Math.random() * 12);

  return {
    id,
    name,
    eta,
    speed: overrides.speed ?? Math.round(8 + Math.random() * 14),
    cargoLoad: overrides.cargoLoad ?? Math.floor(200 + Math.random() * 1800),
    status: overrides.status ?? 'en_route',
    ...overrides,
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
