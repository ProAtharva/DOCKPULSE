import { memo, useMemo } from 'react';

const RECENT_SHIP_COUNT = 3;

function statusTone(st) {
  switch (st) {
    case 'berthed':
      return 'border-emerald-500/25 bg-emerald-500/[0.12] text-emerald-200 ring-emerald-500/20';
    case 'queued':
      return 'border-rose-500/25 bg-rose-500/[0.1] text-rose-200 ring-rose-500/15';
    case 'approaching':
      return 'border-amber-500/25 bg-amber-500/[0.12] text-amber-100 ring-amber-500/20';
    case 'arrived':
      return 'border-teal-500/25 bg-teal-500/[0.1] text-teal-200 ring-teal-400/15';
    default:
      return 'border-sky-500/25 bg-sky-500/[0.1] text-sky-200 ring-sky-500/20';
  }
}

export default memo(function ShipList({ ships }) {
  const all = ships || [];
  const total = all.length;

  /** New ships are appended in simulation — last N are the most recent. */
  const list = useMemo(() => {
    const src = ships || [];
    if (src.length <= RECENT_SHIP_COUNT) return [...src].reverse();
    return src.slice(-RECENT_SHIP_COUNT).reverse();
  }, [ships]);

  return (
    <div className="glass-panel flex h-full min-h-[220px] max-h-[min(44vh,520px)] flex-col overflow-hidden p-5 lg:p-6 xl:min-h-[260px] xl:max-h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" aria-hidden />
            <h2 className="dpt-label text-slate-400">Active ships</h2>
          </div>
          {total > RECENT_SHIP_COUNT && (
            <p className="mt-1.5 pl-8 text-[11px] text-slate-500">Showing {RECENT_SHIP_COUNT} most recent · {total} total</p>
          )}
        </div>
        <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-slate-300">
          {total > RECENT_SHIP_COUNT ? `${RECENT_SHIP_COUNT}/${total}` : total}
        </span>
      </div>
      <ul className="custom-scroll flex flex-1 flex-col gap-3 overflow-y-auto pr-1.5">
        {total === 0 && (
          <li className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-slate-950/50 px-6 py-14 text-center">
            <div className="mb-3 h-12 w-12 rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/20 to-transparent" />
            <p className="text-base font-medium text-slate-300">No vessels in view</p>
            <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-slate-500">
              Traffic will appear here as the simulation adds ships.
            </p>
          </li>
        )}
        {list.map((s, i) => (
          <li
            key={s.id}
            className="animate-fade-in group rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-transparent px-4 py-3 shadow-inner shadow-black/20 transition hover:border-cyan-400/25 hover:from-white/[0.09]"
            style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">{s.name}</p>
                <p className="mt-0.5 font-mono text-[10px] tracking-wide text-slate-500">{s.id.slice(0, 8)}…</p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ring-1 ${statusTone(s.status)}`}
              >
                {s.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3 font-mono text-[10px] text-slate-400">
              <span>
                ETA <strong className="font-semibold text-slate-300">{s.eta ?? '—'}</strong> min
              </span>
              <span>
                <strong className="font-semibold text-slate-300">{s.speed ?? '—'}</strong> kn
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
