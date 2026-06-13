import { useEffect, useRef, useState } from 'react';
import type { Route, RouteSegment } from '../types/route';
import type { Location } from '../types/location';

interface NavigationHUDProps {
  route: Route;
  onStop: () => void;
  onPositionUpdate: (pos: Location, heading: number | null) => void;
}

function toRad(d: number) { return d * Math.PI / 180; }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function bearingDiff(from: number, to: number): number {
  return ((to - from) + 540) % 360 - 180;
}

function turnLabel(deg: number): string {
  if (deg < -60) return 'Sharp left';
  if (deg < -20) return 'Turn left';
  if (deg >  60) return 'Sharp right';
  if (deg >  20) return 'Turn right';
  return 'Continue straight';
}

function turnArrow(deg: number): string {
  if (deg < -60) return '↰';
  if (deg < -20) return '←';
  if (deg >  60) return '↱';
  if (deg >  20) return '→';
  return '↑';
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtTime(mins: number): string {
  if (mins < 1) return '<1 min';
  return `${Math.round(mins)} min`;
}

type Side = 'left' | 'right' | 'either';

function StreetSideVisual({ side }: { side: Side }) {
  if (side === 'either') return null;
  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="flex items-end gap-px h-9">
        <div
          className="w-7 h-full rounded-l-lg transition-all"
          style={{ background: side === 'left' ? 'var(--primary)' : 'var(--muted)', opacity: side === 'left' ? 1 : 0.35 }}
        />
        <div className="w-4 h-full" style={{ background: '#c8d4e0' }}>
          <div className="w-full h-full flex flex-col justify-center items-center gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-0.5 h-1.5 rounded-full" style={{ background: '#8aa0b8' }} />
            ))}
          </div>
        </div>
        <div
          className="w-7 h-full rounded-r-lg transition-all"
          style={{ background: side === 'right' ? 'var(--primary)' : 'var(--muted)', opacity: side === 'right' ? 1 : 0.35 }}
        />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
          Walk on the <span className="capitalize">{side}</span> side
        </p>
      </div>
    </div>
  );
}

const NavigationHUD = ({ route, onStop, onPositionUpdate }: NavigationHUDProps) => {
  const [stepIdx,  setStepIdx]  = useState(0);
  const [position, setPosition] = useState<Location | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef  = useRef<number | null>(null);
  const segments    = route.segments;

  const distanceCovered = segments.slice(0, stepIdx).reduce((sum, s) => sum + s.distance, 0);
  const totalDistance   = route.totalDistance;
  const distanceLeft    = Math.max(0, totalDistance - distanceCovered);
  const timeLeft        = (distanceLeft / 1000 / 5) * 60;

  const currentSeg: RouteSegment | undefined = segments[stepIdx];
  const nextSeg:    RouteSegment | undefined = segments[stepIdx + 1];
  const nextTurn = nextSeg ? bearingDiff(currentSeg?.bearing ?? 0, nextSeg.bearing) : null;
  const distToTurn = position && currentSeg
    ? haversine(position.lat, position.lng, currentSeg.end.lat, currentSeg.end.lng)
    : currentSeg?.distance ?? 0;

  const stepIdxRef  = useRef(stepIdx);
  const segmentsRef = useRef(segments);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  useEffect(() => {
    if (!('geolocation' in navigator)) { setGpsError('Geolocation not available'); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: Location = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Current' };
        setPosition(loc);
        setGpsError(null);
        onPositionUpdate(loc, pos.coords.heading ?? null);
        const idx  = stepIdxRef.current;
        const segs = segmentsRef.current;
        const seg  = segs[idx];
        if (seg) {
          const distToEnd = haversine(loc.lat, loc.lng, seg.end.lat, seg.end.lng);
          if (distToEnd < 25 && idx < segs.length - 1) setStepIdx((i) => i + 1);
        }
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shadeSide = currentSeg?.shadedSide as Side | undefined ?? 'either';
  const shade = route.shadeCoverage;
  const arrived = stepIdx >= segments.length;
  const progress = Math.min(100, (distanceCovered / totalDistance) * 100);

  // Flash the current-instruction card briefly whenever the step advances.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(t);
  }, [stepIdx]);

  // Next up-to-2 *significant* turns ahead (skips minor geometry jitter), with
  // each turn's recommended shaded side — for the "Coming up" list.
  const upcoming: { turn: number; side: Side }[] = [];
  for (let i = stepIdx + 1; i < segments.length && upcoming.length < 2; i++) {
    const turn = bearingDiff(segments[i - 1].bearing ?? 0, segments[i].bearing ?? 0);
    if (Math.abs(turn) > 20) upcoming.push({ turn, side: segments[i].shadedSide as Side });
  }

  return (
    <div className="flex flex-col h-full">

      {/* Progress bar */}
      <div className="h-1 flex-shrink-0" style={{ background: 'var(--muted)' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--primary)' }}
        />
      </div>

      {/* Top strip */}
      <div
        className="px-5 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>REMAINING</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold" style={{ color: 'var(--foreground)', letterSpacing: '-0.03em' }}>{fmtDist(distanceLeft)}</span>
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>· {fmtTime(timeLeft)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shade pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--primary)', fontFamily: "'JetBrains Mono', monospace" }}>{shade}%</span>
          </div>

          {/* End button */}
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{ background: 'rgba(212,24,61,0.08)', color: '#d4183d' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            End
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {arrived ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <p className="text-4xl mb-2">☂️</p>
            <p className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>You&apos;ve arrived!</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>Walked in {shade}% shade coverage</p>
            <button
              onClick={onStop}
              className="mt-4 w-full py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98]"
              style={{ background: 'var(--primary)', color: '#fff', boxShadow: '0 4px 20px rgba(26,95,180,0.3)' }}
            >
              Finish
            </button>
          </div>
        ) : (
          <>
            {/* Current instruction */}
            <div
              className="rounded-2xl p-4 transition-all duration-300"
              style={{
                background: '#fff',
                border: '2px solid var(--primary)',
                boxShadow: flash ? '0 6px 30px rgba(26,95,180,0.30)' : '0 4px 24px rgba(26,95,180,0.12)',
                transform: flash ? 'scale(1.012)' : 'scale(1)',
              }}
            >
              <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>NOW</p>
              <div className="flex gap-3 items-start">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-2xl"
                  style={{ background: 'var(--primary)' }}
                >
                  ↑
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--foreground)' }}>Continue along route</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDist(currentSeg?.distance ?? 0)}
                  </p>
                </div>
              </div>

              {shadeSide !== 'either' && (
                <>
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <StreetSideVisual side={shadeSide} />
                    </div>
                </>
              )}
            </div>

            {/* Next turn */}
            {nextTurn !== null && nextSeg && (
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
                  IN {fmtDist(distToTurn)}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ background: 'var(--secondary)', color: 'var(--primary)' }}
                  >
                    {turnArrow(nextTurn)}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{turnLabel(nextTurn)}</p>
                </div>
                {(nextSeg.shadedSide as string) !== 'either' && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Then walk on the {nextSeg.shadedSide} side
                  </p>
                )}
              </div>
            )}

            {/* Coming up */}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.15em] mb-2 px-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>Coming up</p>
                <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid var(--border)' }}>
                  {upcoming.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5"
                      style={{ borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                        {turnArrow(u.turn)}
                      </div>
                      <p className="flex-1 text-sm" style={{ color: 'var(--foreground)' }}>{turnLabel(u.turn)}</p>
                      {u.side !== 'either' && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--secondary)' }}>
                          <span className="text-xs" style={{ color: 'var(--primary)' }}>{u.side === 'left' ? '‹' : '›'}</span>
                          <span className="text-xs" style={{ color: 'var(--primary)', fontWeight: 500 }}>{u.side}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Shade', value: `${shade}%`, accent: true },
                { label: 'UV Index', value: route.uvIndex.toFixed(1), accent: false },
                { label: 'Step', value: `${stepIdx + 1}/${segments.length}`, accent: false },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#fff', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                  <p className="font-semibold" style={{ color: accent ? 'var(--primary)' : 'var(--foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* GPS error */}
            {gpsError && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,24,61,0.06)', border: '1px solid rgba(212,24,61,0.15)' }}>
                <p className="text-xs" style={{ color: '#d4183d' }}>
                  <span className="font-semibold">Location issue:</span> {gpsError}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NavigationHUD;
