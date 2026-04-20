import { useEffect, useRef, useState } from 'react';
import { getShipTargetPosition } from '../utils/geo';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Smooth cubic ease-out between server snapshots (2s tick → ~1.4s glide per leg).
 */
export function useSmoothShipPositions(ships, berths, durationMs = 1400) {
  const [positions, setPositions] = useState({});
  const lastRef = useRef({});
  const rafId = useRef(null);

  const motionKey = ships
    .map((s) => `${s.id}:${s.status}:${s.eta ?? ''}:${s.queuedAtBerthId ?? ''}`)
    .join('|');

  useEffect(() => {
    const targets = {};
    ships.forEach((s) => {
      targets[s.id] = getShipTargetPosition(s, berths);
    });

    const from = { ...lastRef.current };
    ships.forEach((s) => {
      if (!from[s.id]) from[s.id] = targets[s.id];
    });

    const start = performance.now();
    cancelAnimationFrame(rafId.current);

    const frame = (now) => {
      const elapsed = now - start;
      const k = Math.min(1, elapsed / durationMs);
      const e = 1 - (1 - k) ** 3;
      const next = {};
      ships.forEach((s) => {
        const fr = from[s.id] ?? targets[s.id];
        const to = targets[s.id];
        next[s.id] = [lerp(fr[0], to[0], e), lerp(fr[1], to[1], e)];
      });
      lastRef.current = next;
      setPositions(next);
      if (k < 1) rafId.current = requestAnimationFrame(frame);
    };

    rafId.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId.current);
  }, [motionKey, berths, durationMs]);

  return positions;
}
