/** Fixed quay anchors (synthetic harbour — matches backend Q1…Q5). */
const BASE = [18.9452, 72.949];

export const BERTH_COORDS = {
  Q1: [18.9468, 72.9465],
  Q2: [18.9464, 72.9482],
  Q3: [18.9456, 72.9498],
  Q4: [18.9448, 72.9512],
  Q5: [18.9440, 72.9526],
};

const SEA = [18.918, 72.92];
const CHANNEL = [18.935, 72.937];

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpLatLng([la, ln], [lb, ll], t) {
  return [lerp(la, lb, t), lerp(ln, ll, t)];
}

/**
 * Derive display coordinates from simulation fields (no lat/lng on server).
 */
export function getShipTargetPosition(ship, berths) {
  const bId = (berths || []).find((b) => b.shipId === ship.id || b.currentShip === ship.id)?.id;

  if (ship.status === 'berthed' && bId && BERTH_COORDS[bId]) {
    return BERTH_COORDS[bId];
  }

  if (ship.status === 'queued') {
    const q = ship.queuedAtBerthId && BERTH_COORDS[ship.queuedAtBerthId]
      ? BERTH_COORDS[ship.queuedAtBerthId]
      : BERTH_COORDS.Q3;
    return [q[0] - 0.004, q[1] + 0.0025];
  }

  if (ship.status === 'approaching') {
    const t = Math.max(0, Math.min(1, (3 - (ship.eta ?? 0)) / 3));
    return lerpLatLng(CHANNEL, BASE, t);
  }

  if (ship.status === 'arrived') {
    return lerpLatLng(CHANNEL, BASE, 0.92);
  }

  const maxEta = 16;
  const e = ship.eta ?? 8;
  const t = 1 - Math.max(0, Math.min(1, e / maxEta));
  return lerpLatLng(SEA, CHANNEL, t);
}

export function mapCenter() {
  return BASE;
}

export function defaultZoom() {
  return 13;
}
