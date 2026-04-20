import { memo, useMemo } from 'react';
import { displayCongestionScore } from '../utils/formatters';

export default memo(function MetricsBar({ ships, decision, tickMs }) {
  const activeCount = useMemo(
    () => (ships || []).filter((s) => s.status !== 'berthed').length,
    [ships],
  );

  const queued = useMemo(() => (ships || []).filter((s) => s.status === 'queued').length, [ships]);

  const avgWaitEstimate = useMemo(() => {
    const w = decision?.waitingShips ?? queued;
    if (w === 0) return '0';
    return `${(w * 2.2).toFixed(1)}`;
  }, [decision, queued]);

  const rawCong = decision?.congestionScore;
  const cong = rawCong == null || Number.isNaN(Number(rawCong)) ? '—' : displayCongestionScore(rawCong);
  const util = decision?.berthUtilizationPercent ?? 0;

  return (
    <section className="mb-10" aria-label="Key metrics">
      <div className="mb-4 flex items-center gap-2 px-0.5">
        <span className="h-px flex-1 max-w-[40px] rounded-full bg-gradient-to-r from-cyan-500/60 to-transparent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Live metrics</span>
        <span className="h-px flex-1 rounded-full bg-gradient-to-l from-transparent to-slate-700/40" />
      </div>
      <div className="flex flex-wrap items-stretch gap-4 md:gap-5">
        <MetricTile
          label="Active (not berthed)"
          value={activeCount}
          hint="vessels in flow"
          accent="from-cyan-500/10 via-slate-900/30 to-slate-900/0"
          dot="bg-cyan-400"
        />
        <MetricTile
          label="Avg wait (est.)"
          value={`${avgWaitEstimate} min`}
          hint="queue heuristic"
          accent="from-indigo-500/10 via-slate-900/30 to-transparent"
          dot="bg-indigo-400"
        />
        <MetricTile
          label="Congestion"
          value={cong}
          hint={decision?.predictionLabel ? `15m · ${decision.predictionLabel}` : 'score 0–100'}
          accent="from-amber-500/10 via-slate-900/30 to-transparent"
          dot="bg-amber-400"
        />
        <div className="glass-panel glass-panel--raise flex min-w-[min(100%,260px)] flex-[1.35] flex-row items-stretch justify-between gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-900/70 to-slate-950/50 p-4 md:min-w-[320px]">
          <div className="min-w-0 flex-1">
            <p className="dpt-label">Throughput</p>
            <p className="mt-2 font-mono text-sm leading-snug text-slate-200">
              <span className="text-cyan-300/90">{util}%</span> berth use
              <span className="text-slate-600"> · </span>
              <span className="text-slate-400">tick {tickMs || 2000}ms</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              State synced from simulation loop; safe for ops readout.
            </p>
          </div>
          <div
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/25 to-fuchsia-600/15 shadow-glow"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_55%)]" />
          </div>
        </div>
      </div>
    </section>
  );
});

function MetricTile({ label, value, hint, accent, dot }) {
  return (
    <div
      className={`glass-panel glass-panel--raise relative min-w-[140px] flex-1 overflow-hidden rounded-2xl p-4 ${accent}`}
    >
      <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.06] bg-black/20">
        <span className={`h-2 w-2 rounded-full ${dot} opacity-90 shadow-lg`} />
      </div>
      <p className="dpt-label pr-10 leading-relaxed text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-white">{value}</p>
      {hint && <p className="mt-1.5 text-[11px] font-medium text-slate-500">{hint}</p>}
    </div>
  );
}
