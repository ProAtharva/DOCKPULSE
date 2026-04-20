import { memo, useId, useMemo } from 'react';

const MODE_META = {
  none: { label: 'None', stroke: '#22d3ee' },
  weather: { label: 'Weather', stroke: '#fbbf24' },
  crane_failure: { label: 'Crane fault', stroke: '#e879f9' },
};

const MODE_ORDER = ['none', 'weather', 'crane_failure'];

function yForValue(v, padT, innerH, maxY) {
  const top = padT;
  const denom = Math.max(1e-6, maxY);
  const clamped = Math.min(100, Math.max(0, Number(v) || 0));
  const y = top + (1 - clamped / denom) * innerH;
  return Number.isFinite(y) ? y : top + innerH * 0.5;
}

function buildMultiPaths(timelinesByMode, baseline, W, H, padL, padR, padT, padB) {
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allScores = [];
  for (const m of MODE_ORDER) {
    const tl = timelinesByMode[m]?.timeline;
    if (tl?.length) {
      allScores.push(...tl.map((t) => Number(t.congestionScore) || 0));
    }
  }

  const maxY = Math.max(100, baseline ?? 0, ...allScores, 8);

  const linePathForTimeline = (timeline) => {
    if (!timeline?.length) return '';
    const scores = timeline.map((t) => Number(t.congestionScore) || 0);
    const len = scores.length;
    const pts = scores.map((v, i) => {
      const x = padL + (len === 1 ? innerW * 0.5 : (i / (len - 1)) * innerW);
      const y = yForValue(v, padT, innerH, maxY);
      return [x, y];
    });
    return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  };

  const lines = {};
  for (const m of MODE_ORDER) {
    lines[m] = linePathForTimeline(timelinesByMode[m]?.timeline);
  }

  const baselineY = yForValue(baseline ?? 0, padT, innerH, maxY);

  return { kind: 'multi', lines, baselineY, maxY, w: W, h: H, padL };
}

function buildLegacyPath(timeline, baseline, peak, W, H, padL, padR, padT, padB) {
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const scores = timeline.map((t) => Number(t.congestionScore) || 0);
  const maxY = Math.max(100, baseline ?? 0, peak ?? 0, ...scores, 8);

  const len = scores.length;
  const pts = scores.map((v, i) => {
    const x = padL + (len === 1 ? innerW * 0.5 : (i / (len - 1)) * innerW);
    const y = yForValue(v, padT, innerH, maxY);
    return [x, y];
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const baselineY = yForValue(baseline ?? 0, padT, innerH, maxY);

  return { kind: 'legacy', linePath, baselineY, w: W, h: H, padL };
}

export default memo(function CongestionChart({ timeline, timelinesByMode, baseline, peak }) {
  const uid = useId().replace(/:/g, '');
  const legacyGradId = `lg-${uid}`;

  const dims = useMemo(() => {
    const W = 480;
    const H = 196;
    const padL = 44;
    const padR = 16;
    const padT = 22;
    const padB = 34;

    const hasAnyModeTimeline =
      timelinesByMode &&
      MODE_ORDER.some((m) => timelinesByMode[m]?.timeline && timelinesByMode[m].timeline.length > 0);

    if (hasAnyModeTimeline) {
      return buildMultiPaths(timelinesByMode, baseline, W, H, padL, padR, padT, padB);
    }

    if (timeline?.length) {
      return buildLegacyPath(timeline, baseline, peak, W, H, padL, padR, padT, padB);
    }

    return { kind: 'empty', w: W, h: H };
  }, [timeline, timelinesByMode, baseline, peak]);

  const { w, h } = dims;

  if (dims.kind === 'empty') {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-slate-950/50 text-center">
        <p className="text-sm font-medium text-slate-400">No projection yet</p>
        <p className="mt-1 text-xs text-slate-600">Run a scenario to plot congestion</p>
      </div>
    );
  }

  const isMulti = dims.kind === 'multi';
  const hasAnyStroke =
    isMulti && MODE_ORDER.some((m) => dims.lines[m] && dims.lines[m].length > 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-slate-950/60 shadow-inner shadow-black/40">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.06),transparent_55%)]"
        aria-hidden
      />
      <svg viewBox={`0 0 ${w} ${h}`} className="relative h-52 w-full md:h-56" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={legacyGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
        </defs>

        <text x="12" y="20" fill="rgba(148,163,184,0.95)" style={{ fontSize: '11px', fontWeight: 600 }}>
          {isMulti ? 'Predicted congestion (3 disruption modes)' : 'Predicted congestion'}
        </text>
        <text x="12" y="36" fill="rgba(100,116,139,0.9)" style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace' }}>
          {isMulti ? '0 — 100 · same extra ships & delay; curve = mode only' : '0 — 100'}
        </text>

        {baseline != null && (
          <line
            x1={dims.padL ?? 44}
            y1={dims.baselineY}
            x2={w - 16}
            y2={dims.baselineY}
            stroke="rgba(251,191,36,0.55)"
            strokeDasharray="6 4"
            strokeWidth="1.2"
          />
        )}

        {isMulti &&
          MODE_ORDER.map((m) => {
            const d = dims.lines[m];
            if (!d) return null;
            const meta = MODE_META[m];
            return (
              <path
                key={m}
                d={d}
                fill="none"
                stroke={meta.stroke}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

        {!isMulti && dims.linePath && (
          <path
            d={dims.linePath}
            fill="none"
            stroke={`url(#${legacyGradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {isMulti && !hasAnyStroke && (
          <text x={w / 2} y={h / 2} fill="#94a3b8" style={{ fontSize: '11px' }} textAnchor="middle">
            No curve data
          </text>
        )}

        <text
          x={w - 10}
          y={h - 10}
          fill="rgba(148,163,184,0.8)"
          style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace' }}
          textAnchor="end"
        >
          t → 15 min
        </text>

        {isMulti && (
          <g transform={`translate(12, ${h - 26})`}>
            {MODE_ORDER.map((m, i) => {
              const meta = MODE_META[m];
              return (
                <g key={m} transform={`translate(${i * 142}, 0)`}>
                  <line x1="0" y1="5" x2="16" y2="5" stroke={meta.stroke} strokeWidth="2.5" />
                  <text x="20" y="8" fill="rgba(148,163,184,0.95)" style={{ fontSize: '9px', fontWeight: 600 }}>
                    {meta.label}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {isMulti && (
        <p className="border-t border-white/[0.05] px-4 py-2 text-[10px] leading-relaxed text-slate-500">
          <span className="text-amber-400/80">Dashed line</span> is live baseline before the run. Three traces use identical
          extra ships and delay factor; only the disruption model differs.
        </p>
      )}
    </div>
  );
});
