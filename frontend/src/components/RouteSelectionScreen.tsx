import { useState } from 'react';
import type { RouteComparison } from '../types/route';

interface RouteSelectionScreenProps {
  comparison: RouteComparison;
  fromName: string;
  toName: string;
  onBack: () => void;
  onSelect: (route: 'shaded' | 'shortest') => void;
}

function fmt(metres: number) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

const UmbrellaIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7" />
  </svg>
);

const ZapIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

/** Count how many segments recommend each sidewalk (from real backend data). */
function walkSideSummary(segments: { shadedSide: 'left' | 'right' | 'either' }[]) {
  let left = 0, right = 0;
  for (const s of segments) {
    if (s.shadedSide === 'left') left++;
    else if (s.shadedSide === 'right') right++;
  }
  return { left, right };
}

function ShadeDial({ value, color }: { value: number; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs" style={{ color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{value}%</span>
        </div>
      </div>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>shade</span>
    </div>
  );
}

function ShadeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{value}%</span>
    </div>
  );
}

export function RouteSelectionScreen({ comparison, fromName, toName, onBack, onSelect }: RouteSelectionScreenProps) {
  const [selected, setSelected] = useState<'shaded' | 'shortest'>('shaded');
  const { shadedRoute, shortestRoute, isSameRoute } = comparison;

  const routes = isSameRoute
    ? [{ key: 'shaded' as const, label: 'Shaded Route', tag: 'Best Option', icon: UmbrellaIcon, color: '#1a5fb4', route: shadedRoute,
         desc: 'The shadiest path — and it happens to be the shortest too' }]
    : [
        { key: 'shaded'   as const, label: 'Shaded Route',  tag: 'Most Shade', icon: UmbrellaIcon, color: '#1a5fb4', route: shadedRoute,
          desc: 'Shadiest path within the 20% detour limit' },
        { key: 'shortest' as const, label: 'Shortest Route', tag: 'Fastest',   icon: ZapIcon,      color: '#0ea5b0', route: shortestRoute,
          desc: 'The most direct path — fewer turns, less shade' },
      ];

  return (
    /* Outer: grows with content; the parent scrolls so the footer is always reachable */
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--background)', fontFamily: "'Inter', sans-serif" }}>

      {/* Blue header — fixed height */}
      <div className="flex-shrink-0 px-4 pb-5" style={{ background: 'var(--primary)', paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
        <button className="mb-4 p-1 -ml-1 opacity-80" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <p className="text-xs tracking-[0.15em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>Shade Routes</p>
        <p className="text-white text-sm opacity-75 truncate">{fromName}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          <p className="text-white font-medium truncate">{toName}</p>
        </div>
      </div>

      {/* Route cards — natural height; button follows directly below */}
      <div className="px-4 py-4">
        {isSameRoute && (
          <div className="mb-3 px-3 py-2 rounded-xl" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--primary)', fontWeight: 500 }}>
              The shadiest route is also the shortest — no detour needed ☂️
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {routes.map(({ key, label, tag, icon, color, route, desc }) => {
            const isSelected = selected === key;
            const sides = walkSideSummary(route.segments);
            return (
              <button
                key={key}
                className="w-full text-left rounded-2xl p-4 transition-all duration-200"
                style={{
                  background: '#fff',
                  border: `2px solid ${isSelected ? color : 'var(--border)'}`,
                  boxShadow: isSelected ? `0 4px 24px ${color}25` : 'none',
                }}
                onClick={() => setSelected(key)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{label}</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: color + '18', color }}>
                        {icon}
                        <span className="text-xs" style={{ fontWeight: 500 }}>{tag}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{Math.round(route.estimatedTime)} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4v16M5 8l4-4 4 4M5 16l4 4 4-4"/></svg>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{fmt(route.totalDistance)}</span>
                      </div>
                    </div>
                    <ShadeBar value={route.shadeCoverage} color={color} />
                    <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
                    {route.detourDistance > 0 && (
                      <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        {fmt(route.detourDistance)} longer than shortest path
                      </p>
                    )}
                  </div>
                  <ShadeDial value={route.shadeCoverage} color={color} />
                </div>

                {/* Walk-side guidance — derived from real per-segment data */}
                {isSelected && (sides.left > 0 || sides.right > 0) && (
                  <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                    {sides.left > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)', fontWeight: 500 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        Walk left · {sides.left} {sides.left === 1 ? 'leg' : 'legs'}
                      </span>
                    )}
                    {sides.right > 0 && (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)', fontWeight: 500 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        Walk right · {sides.right} {sides.right === 1 ? 'leg' : 'legs'}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Navigation — directly under the cards, always on screen */}
      <div className="px-4 pt-1 pb-10">
        <button
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: 'var(--primary)', color: '#fff', fontWeight: 500, boxShadow: '0 4px 24px rgba(26,95,180,0.35)' }}
          onClick={() => onSelect(selected)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          Start Navigation
        </button>
      </div>
    </div>
  );
}
