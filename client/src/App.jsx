import MapView from './components/MapView';
import ShipList from './components/ShipList';
import SuggestionsPanel from './components/SuggestionsPanel';
import MetricsBar from './components/MetricsBar';
import ScenarioPanel from './components/ScenarioPanel';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const { connected, state, lastEvent } = useWebSocket();

  const ships = state.ships || [];
  const berths = state.berths || [];
  const decision = state.decision || {};
  const tickMs = state.tickMs;

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[#030712]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_-25%,rgba(34,211,238,0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_0%,rgba(217,70,239,0.06),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCcgdmlld0JveD0nMCAwIDY0IDY0Jz48ZyBmaWxsPSdub25lJyBmaWxsLXJ1bGU9J2V2ZW5vZGQnPjxwYXRoIHN0cm9rZT0ncmdiYSgyNTUsMjU1LDI1NSwwLjAzNSknIHN0cm9rZS13aWR0aD0nMC41JyBkPSdNMCAwaDY0djY0SDB6TTMyIDBoMzJ2Nk0zMiAyNGgzMlYxMk0zMiA0OGgzMlYzNk0zMiA2NGgzMlY1Mk0wIDMyaDJ2NEgwTTAgMTZoMnY0SDBtMCAzMmgydjRIMH00OCAwaDJ2NmgtMnptLTI0IDBoMnY2aC0yek0yNCAwaDJ2NmgtMnptMCA0OGgydjZoLTJ6bTI0LTQ4aDJ2NmgtMnptMCAyNGgydjZoLTJ6TTAgMjRoMzJWNjBNMCAxMmgzMlYwbTAgNGgzMlYwbTAgNDhoMzJWMzZNMCA1NmgzMlY0OCIvPjwvZz48L3N2Zz4=')] opacity-[0.45]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-full max-w-[1920px] flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <header className="mb-10 flex flex-col gap-8 border-b border-white/[0.06] pb-10 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-xl border-2 border-cyan-400/50 bg-gradient-to-b from-cyan-500/30 to-cyan-950/70 px-4 py-2 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-300/25 sm:text-base sm:tracking-[0.16em]">
                DockPulse
              </span>
              <span className="rounded-lg border border-slate-500/35 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300 sm:text-xs">
                Autonomous port intelligence
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-[2.4rem] lg:leading-[1.1]">
              Port digital twin
              <span className="mt-1 block bg-gradient-to-r from-cyan-200 via-white to-fuchsia-300/90 bg-clip-text text-transparent">
                live decisions &amp; forecasts
              </span>
            </h1>
            <p className="mt-5 text-sm leading-[1.65] text-slate-400 md:text-[0.98rem]">
              Streaming state over WebSockets, Redis-backed events, and a sandbox{' '}
              <strong className="font-semibold text-slate-200">what-if engine</strong> — one surface for operators and
              planners.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            <div
              className={`flex items-center gap-3 rounded-2xl border px-6 py-3.5 text-sm font-semibold shadow-inner shadow-black/30 ${
                connected
                  ? 'border-emerald-400/45 bg-emerald-950/55 text-emerald-50'
                  : 'border-rose-400/40 bg-rose-950/45 text-rose-100'
              }`}
            >
              <span
                className={`relative flex h-2.5 w-2.5 rounded-full ${
                  connected ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]' : 'bg-rose-500'
                }`}
              >
                {connected && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 opacity-40" />
                )}
              </span>
              {connected ? 'Twin connected' : 'Reconnecting…'}
            </div>
            <div className="hidden h-12 w-px bg-white/10 sm:block" aria-hidden />
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3 text-right">
              <p className="dpt-label">Sync interval</p>
              <p className="font-mono text-lg font-semibold tabular-nums text-cyan-200/95">{tickMs || 2000} ms</p>
            </div>
          </div>
        </header>

        <MetricsBar ships={ships} decision={decision} tickMs={tickMs} />

        <section className="mb-10 lg:mb-12" aria-label="What-if simulation">
          <ScenarioPanel />
        </section>

        {/* Left: map + decision engine stacked; right: ships & berths. */}
        <div className="flex min-h-[min(92vh,960px)] flex-col gap-8 xl:flex-row xl:items-stretch xl:gap-10 2xl:gap-12">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 xl:h-full">
            <div className="flex min-h-0 flex-1 flex-col">
              <MapView ships={ships} berths={berths} />
            </div>
            <div className="w-full shrink-0">
              <SuggestionsPanel lastEvent={lastEvent} connected={connected} />
            </div>
          </div>

          <aside className="flex w-full min-w-0 shrink-0 flex-col gap-6 xl:h-full xl:min-h-0 xl:w-[min(100%,440px)] xl:max-w-md 2xl:w-[min(100%,500px)] 2xl:max-w-lg">
            <div className="min-h-0 flex-1">
              <ShipList ships={ships} />
            </div>

            <div className="glass-panel glass-panel--raise shrink-0 p-6 lg:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1.5 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" aria-hidden />
                <h2 className="dpt-label text-[11px] tracking-[0.22em] text-slate-400">Berth status</h2>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4">
                {berths.map((b) => {
                  const free = b.status === 'free' && !b.currentShip;
                  return (
                    <li
                      key={b.id}
                      className="flex min-h-[5rem] flex-col justify-center rounded-2xl border border-white/[0.06] bg-slate-950/50 px-4 py-4 transition hover:border-cyan-400/25"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-3 w-3 shrink-0 rounded-full ${
                              free ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]' : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-mono text-lg font-semibold text-white">{b.id}</span>
                        </div>
                        <span
                          className={`w-fit rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                            free
                              ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                              : 'border border-rose-500/30 bg-rose-500/10 text-rose-100'
                          }`}
                        >
                          {free ? 'Free' : 'Busy'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
