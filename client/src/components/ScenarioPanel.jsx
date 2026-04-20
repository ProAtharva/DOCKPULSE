import { memo, useState } from 'react';
import CongestionChart from './CongestionChart';

export default memo(function ScenarioPanel() {
  const [numberOfShips, setNumberOfShips] = useState(3);
  const [delayFactor, setDelayFactor] = useState(0.25);
  const [disruptionType, setDisruptionType] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function runSimulation(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/simulate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numberOfShips: Number(numberOfShips),
          delayFactor: Number(delayFactor),
          disruptionType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-fuchsia-950/[0.15] p-px shadow-glass-lg">
      <div className="rounded-[15px] bg-slate-950/40 p-4 backdrop-blur-xl md:p-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-200/90">
                What-if
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Sandbox</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white md:text-2xl">Disruption &amp; forecast</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Projects the next <strong className="text-slate-200">15 minutes</strong> without mutating live traffic.
              Tune arrivals, weather delay, or a crane outage.
            </p>
          </div>
          <button
            type="submit"
            form="scenario-form"
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/35 bg-slate-900 px-8 py-3.5 text-sm font-semibold tracking-wide text-cyan-50 shadow-md shadow-black/30 transition hover:border-cyan-300/60 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-300"
                  aria-hidden
                />
                Running…
              </>
            ) : (
              'Run simulation'
            )}
          </button>
        </div>

        <form id="scenario-form" className="grid gap-5 md:grid-cols-12 md:gap-4" onSubmit={runSimulation}>
          <label className="md:col-span-3">
            <span className="dpt-label mb-2 block text-slate-500">Extra ships</span>
            <input
              type="number"
              min={0}
              max={50}
              value={numberOfShips}
              onChange={(e) => setNumberOfShips(e.target.value)}
              className="dpt-input"
            />
          </label>
          <label className="md:col-span-3">
            <span className="dpt-label mb-2 block text-slate-500">Delay factor</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={delayFactor}
              onChange={(e) => setDelayFactor(e.target.value)}
              className="dpt-input"
            />
            <span className="mt-1.5 block text-[10px] text-slate-500">Weather / ETA stretch</span>
          </label>
          <label className="md:col-span-6">
            <span className="dpt-label mb-2 block text-slate-500">Disruption mode</span>
            <select
              value={disruptionType}
              onChange={(e) => setDisruptionType(e.target.value)}
              className="dpt-select dpt-input"
            >
              <option value="none">None — traffic + delay only</option>
              <option value="weather">Weather — stretch ETAs</option>
              <option value="crane_failure">Crane fault — berth offline &amp; realloc</option>
            </select>
          </label>
        </form>

        {error && (
          <p className="mt-5 rounded-xl border border-rose-500/35 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-8 grid gap-8 border-t border-white/[0.06] pt-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-cyan-400/80" />
                <h3 className="dpt-label text-slate-400">Predicted congestion</h3>
              </div>
              <CongestionChart
                timelinesByMode={result.timelinesByMode}
                timeline={result.timeline}
                baseline={result.baselineCongestion}
                peak={result.peakCongestion}
              />
              {result.timelinesByMode && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    ['none', 'None (traffic + delay)'],
                    ['weather', 'Weather'],
                    ['crane_failure', 'Crane fault'],
                  ].map(([key, label]) => {
                    const d = result.timelinesByMode[key];
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-white/[0.06] bg-slate-950/45 px-3 py-2.5 text-center sm:text-left"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                        <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-100">
                          Peak {d?.peakCongestion ?? '—'}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">Overload {d?.berthOverloadMinutes ?? '—'} min</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat k="Baseline" v={result.baselineCongestion} tone="text-cyan-200" />
                <Stat k="Peak" v={result.peakCongestion} tone="text-fuchsia-200" />
                <Stat
                  k="Δ"
                  v={`${result.congestionDelta >= 0 ? '+' : ''}${result.congestionDelta}`}
                  tone={result.congestionDelta >= 0 ? 'text-amber-200' : 'text-emerald-200'}
                />
                <Stat k="Overload min" v={result.berthOverloadMinutes} tone="text-rose-200" />
              </dl>
              <p className="mt-4 text-xs italic leading-relaxed text-slate-500">{result.summary}</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Risk{' '}
                <span
                  className={
                    result.overloadRisk === 'high'
                      ? 'text-rose-400'
                      : result.overloadRisk === 'moderate'
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                  }
                >
                  {result.overloadRisk}
                </span>
              </p>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-fuchsia-400/70" />
                <h3 className="dpt-label text-slate-400">Recommended moves</h3>
              </div>
              <ul className="space-y-2.5">
                {(result.suggestedActions || []).map((a, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm leading-snug text-slate-200 shadow-inner shadow-black/20 transition hover:border-fuchsia-500/25"
                  >
                    {a.text}
                    <span className="mt-2 block font-mono text-[9px] uppercase tracking-wider text-slate-500">
                      {a.action}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function Stat({ k, v, tone }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-slate-950/50 px-3 py-2">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{k}</dt>
      <dd className={`font-mono text-lg font-semibold tabular-nums ${tone}`}>{v}</dd>
    </div>
  );
}
