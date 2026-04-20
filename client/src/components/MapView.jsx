import { memo, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { BERTH_COORDS, mapCenter, defaultZoom } from '../utils/geo';
import { useSmoothShipPositions } from '../hooks/useSmoothShipPositions';

const LEGEND = [
  { label: 'En route', color: '#38bdf8' },
  { label: 'Approaching', color: '#fbbf24' },
  { label: 'Berthed', color: '#34d399' },
  { label: 'Queued', color: '#fb7185' },
];

/** Leaflet needs explicit pixel height; reflow when the flex parent resizes. */
function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function ShipDot({ name, position, status }) {
  const color =
    status === 'berthed'
      ? '#34d399'
      : status === 'queued'
        ? '#fb7185'
        : status === 'approaching'
          ? '#fbbf24'
          : '#38bdf8';

  return (
    <CircleMarker
      center={position}
      radius={9}
      pathOptions={{
        color: 'rgba(15, 23, 42, 0.95)',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.98,
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1} className="!rounded-lg !border !border-slate-600/60 !bg-slate-900 !px-2.5 !py-2 !text-slate-100 !shadow-xl">
        <span className="block text-xs font-bold">{name}</span>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wide text-slate-400">{status}</span>
      </Tooltip>
    </CircleMarker>
  );
}

function BerthDot({ berth }) {
  const free = berth.status === 'free' && !berth.currentShip;
  const fill = free ? '#22c55e' : '#f43f5e';

  return (
    <CircleMarker
      center={berth.coord}
      radius={13}
      pathOptions={{
        color: 'rgba(12, 12, 18, 0.95)',
        weight: 2,
        fillColor: fill,
        fillOpacity: free ? 0.5 : 0.92,
      }}
    >
      <Tooltip direction="bottom" opacity={1} className="!rounded-lg !border !border-slate-600/60 !bg-slate-900 !px-2.5 !py-2 !shadow-xl">
        <div className="text-xs font-semibold text-slate-100">{berth.id}</div>
        <div className="font-mono text-[10px] text-slate-400">{free ? 'Available' : 'Occupied'}</div>
        {(berth.queueLength ?? 0) > 0 && (
          <div className="mt-0.5 font-mono text-[10px] text-amber-300/95">Lane queue {berth.queueLength}</div>
        )}
      </Tooltip>
    </CircleMarker>
  );
}

function MapInner({ ships, berths }) {
  const [mapOk, setMapOk] = useState(false);
  useEffect(() => {
    setMapOk(true);
  }, []);

  const positions = useSmoothShipPositions(ships, berths);

  const berthLayer = useMemo(
    () =>
      (berths || []).map((b) => ({
        ...b,
        coord: BERTH_COORDS[b.id] || [18.945, 72.949],
      })),
    [berths],
  );

  if (!mapOk) {
    return (
      <div className="absolute inset-0 flex min-h-[240px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950">
        <div
          className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_35%,rgba(34,211,238,0.06)_50%,transparent_65%)] bg-[length:220%_100%]"
          aria-hidden
        />
        <div className="relative z-[1] flex w-full flex-col items-center justify-center gap-2 px-4">
          <div className="h-8 w-8 animate-pulse rounded-full border-2 border-cyan-400/30 border-t-cyan-400/90" />
          <p className="text-sm font-medium text-slate-400">Loading map engine…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 min-h-[240px] overflow-hidden rounded-2xl ring-1 ring-cyan-500/15">
      <MapContainer
        center={mapCenter()}
        zoom={defaultZoom()}
        className="z-0 !h-full !w-full min-h-0 rounded-2xl"
        scrollWheelZoom
        zoomControl={false}
      >
        <InvalidateSizeOnResize />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {berthLayer.map((b) => (
          <BerthDot key={b.id} berth={b} />
        ))}
        {ships.map((s) => {
          const pos = positions[s.id];
          if (!pos) return null;
          return <ShipDot key={s.id} name={s.name} position={pos} status={s.status} />;
        })}
      </MapContainer>
    </div>
  );
}

export default memo(function MapView({ ships, berths }) {
  return (
    <div className="glass-panel flex h-full min-h-0 flex-col p-5 md:p-6">
      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" aria-hidden />
            <h2 className="dpt-label text-slate-300">Geospatial twin</h2>
          </div>
          <p className="mt-1.5 pl-8 text-xs leading-relaxed text-slate-500">
            Synthetic positions from ETA &amp; berth state
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 sm:justify-end sm:pl-0">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative min-h-[min(50vh,420px)] flex-1 basis-0">
        <MapInner ships={ships} berths={berths} />
        <div className="pointer-events-none absolute bottom-4 right-4 z-[500] rounded-xl border border-white/[0.08] bg-slate-950/90 px-3 py-2 text-[11px] font-medium tracking-wide text-slate-400 shadow-lg backdrop-blur-md">
          Berths · <span className="text-emerald-400/95">green</span> free · <span className="text-rose-400/95">red</span>{' '}
          busy
        </div>
      </div>
    </div>
  );
});
