/**
 * Turn engine actions like DELAY_SHIP:uuid into short operator-readable lines.
 */
export function formatSuggestionAction(action) {
  if (!action) return null;
  const t = action.trim();
  if (t === 'MONITOR') return 'Playbook · hold & watch';

  const i = t.indexOf(':');
  if (i === -1) return t.replace(/_/g, ' ');

  const cmd = t.slice(0, i).replace(/_/g, ' ');
  const param = t.slice(i + 1).trim();

  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(param)) {
    return `${cmd} · vessel …${param.slice(-6)}`;
  }
  return `${cmd} · ${param}`;
}

/** Congestion index is shown 0–100 even if backend mixes formulas. */
export function displayCongestionScore(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Math.min(100, Math.max(0, Math.round(Number(n))))}`;
}
