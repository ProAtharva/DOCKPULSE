import { memo, useCallback, useEffect, useState } from 'react';
import { displayCongestionScore, formatSuggestionAction } from '../utils/formatters';

function severityRow(sev) {
  if (sev === 'critical') return 'border-l-[3px] border-l-rose-400 bg-gradient-to-r from-rose-500/[0.12] to-transparent';
  if (sev === 'warning') return 'border-l-[3px] border-l-amber-400 bg-gradient-to-r from-amber-500/[0.1] to-transparent';
  return 'border-l-[3px] border-l-cyan-400/70 bg-gradient-to-r from-cyan-500/[0.08] to-transparent';
}

export default memo(function SuggestionsPanel({ lastEvent, connected }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/suggestions');
      setData(await res.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (
      lastEvent?.type === 'BERTH_ASSIGNED' ||
      lastEvent?.type === 'QUEUE_UPDATED' ||
      lastEvent?.type === 'SHIP_ARRIVED'
    ) {
      load();
    }
  }, [lastEvent?.ts, lastEvent?.type, load]);

  const suggestions = data?.suggestions || [];
  const score = data?.congestionScore;

  return (
    <div className="glass-panel flex w-full min-h-0 flex-col overflow-hidden p-6 lg:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" aria-hidden />
            <h2 className="dpt-label text-slate-400">Decision engine</h2>
          </div>
          <p className="text-xs text-slate-500">From GET /api/suggestions</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {connected ? 'live' : 'offline'}
          </span>
          {score != null && (
            <span className="font-mono text-xs text-slate-500">
              congestion index{' '}
              <span className="font-semibold text-cyan-300/95">{displayCongestionScore(score)}</span>
              <span className="ml-1 text-slate-600">/ 100</span>
            </span>
          )}
        </div>
      </div>

      {lastEvent?.type && (lastEvent.type === 'BERTH_ASSIGNED' || lastEvent.type === 'QUEUE_UPDATED') && (
        <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.07] px-4 py-3 font-mono text-[11px] text-cyan-100/95 shadow-inner shadow-cyan-950/40">
          <span className="text-cyan-400/80">Last event · </span>
          {lastEvent.type}
        </div>
      )}

      <ul className="custom-scroll flex max-h-[min(38vh,420px)] flex-col gap-4 overflow-y-auto pr-1.5 xl:max-h-[min(32vh,380px)]">
        {suggestions.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/[0.06] px-5 py-12 text-center text-sm text-slate-500">
            Pulling recommendations…
          </li>
        )}
        {suggestions.map((s, i) => {
          const actionLine = formatSuggestionAction(s.action);
          return (
            <li
              key={i}
              className={`animate-fade-in rounded-2xl border border-white/[0.06] px-5 py-4 text-[15px] leading-relaxed text-slate-200 transition hover:border-white/[0.12] ${severityRow(s.severity)}`}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <p className="text-[15px] leading-relaxed text-slate-100">{s.text}</p>
              {actionLine && (
                <span className="mt-3 block border-t border-white/[0.06] pt-3 font-mono text-[11px] font-medium tracking-wide text-slate-500">
                  {actionLine}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
