import type { RouteComparison, Route } from '../types/route';

interface RouteResultsProps {
  comparison: RouteComparison | null;
  isCalculating: boolean;
  error?: string;
  selectedRoute: 'shaded' | 'shortest';
  onSelectRoute: (route: 'shaded' | 'shortest') => void;
  onRecalculate?: () => void;
  onStartNavigation?: () => void;
}

function fmt(metres: number) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(2)} km`
    : `${Math.round(metres)} m`;
}

function ShadeDial({ value, color }: { value: number; color: string }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const dashLength = (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle
            cx="28" cy="28" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs" style={{ color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
            {value}%
          </span>
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
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs w-8 text-right" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}%
      </span>
    </div>
  );
}

interface RouteCardProps {
  label: string;
  tag: string;
  route: Route;
  active: boolean;
  color: string;
  onClick: () => void;
}

const RouteCard = ({ label, tag, route, active, color, onClick }: RouteCardProps) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-2xl p-4 transition-all duration-200"
    style={{
      background: '#fff',
      border: `2px solid ${active ? color : 'var(--border)'}`,
      boxShadow: active ? `0 4px 24px ${color}25` : 'none',
    }}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1 pr-3">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{label}</span>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: color + '18', color }}
          >
            <span className="text-xs" style={{ fontWeight: 500 }}>{tag}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{Math.round(route.estimatedTime)} min</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 4v16M5 8l4-4 4 4M5 16l4 4 4-4" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{fmt(route.totalDistance)}</span>
          </div>
        </div>

        <ShadeBar value={route.shadeCoverage} color={color} />
      </div>
      <ShadeDial value={route.shadeCoverage} color={color} />
    </div>
  </button>
);

const RouteResults = ({
  comparison,
  isCalculating,
  error,
  selectedRoute,
  onSelectRoute,
  onRecalculate,
  onStartNavigation,
}: RouteResultsProps) => {

  if (error) {
    return (
      <div className="px-5 pb-6">
        <div className="rounded-2xl p-4" style={{ background: '#fff0f3', border: '1px solid rgba(212,24,61,0.2)' }}>
          <div className="flex items-start gap-3">
            <span style={{ color: '#d4183d', marginTop: 2 }}>⚠</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#d4183d' }}>Route unavailable</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{error}</p>
            </div>
          </div>
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              className="mt-3 w-full py-2.5 rounded-xl font-medium text-sm transition-colors"
              style={{ background: 'rgba(212,24,61,0.08)', color: '#d4183d' }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="px-5 pb-6">
        <div className="rounded-2xl p-6" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Calculating routes</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Analysing sun position & building shadows…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  const { shadedRoute, shortestRoute, isSameRoute } = comparison;
  const active = selectedRoute === 'shaded' ? shadedRoute : shortestRoute;
  const shadeDiff = shadedRoute.shadeCoverage - shortestRoute.shadeCoverage;
  const distDiff  = shadedRoute.totalDistance - shortestRoute.totalDistance;

  const uvColor =
    active.uvIndex <= 2 ? '#3a7d44' :
    active.uvIndex <= 5 ? '#c79a00' :
    active.uvIndex <= 7 ? '#d4670a' : '#d4183d';

  return (
    <div className="px-5 pb-6 space-y-3">
      <div className="h-px" style={{ background: 'var(--border)' }} />

      {/* Route cards */}
      {isSameRoute ? (
        <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
            The shadiest route is also the shortest — no detour needed ☂️
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.15em]" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
            Choose your route
          </p>
          <RouteCard
            label="Shadiest Route"
            tag={shadeDiff > 0 ? `+${shadeDiff}% shade` : 'Most Shade'}
            route={shadedRoute}
            active={selectedRoute === 'shaded'}
            color="#1a5fb4"
            onClick={() => onSelectRoute('shaded')}
          />
          <RouteCard
            label="Shortest Route"
            tag={distDiff > 0 ? `${fmt(distDiff)} shorter` : 'Fastest'}
            route={shortestRoute}
            active={selectedRoute === 'shortest'}
            color="#0ea5b0"
            onClick={() => onSelectRoute('shortest')}
          />
        </div>
      )}

      {/* UV index */}
      <div className="rounded-2xl p-3.5 flex items-center justify-between" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs uppercase tracking-[0.1em] mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>UV Index</p>
          <p className="text-xl font-bold" style={{ color: uvColor }}>
            {active.uvIndex.toFixed(1)}
            <span className="text-sm font-medium ml-1.5" style={{ color: uvColor }}>
              {active.uvIndex <= 2 ? 'Low' : active.uvIndex <= 5 ? 'Moderate' : active.uvIndex <= 7 ? 'High' : 'Very High'}
            </span>
          </p>
        </div>
        <span className="text-2xl">☀️</span>
      </div>

      {/* Detour note */}
      {active.detourDistance > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl p-3" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{fmt(active.detourDistance)} longer</span> than the shortest path for better shade.
          </p>
        </div>
      )}

      {/* Start Navigation */}
      {onStartNavigation && (
        <button
          onClick={onStartNavigation}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'var(--primary)', color: '#fff', fontWeight: 500, boxShadow: '0 4px 24px rgba(26,95,180,0.35)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
          Start Navigation
        </button>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            className="text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            Recalculate
          </button>
        )}
      </div>
    </div>
  );
};

export default RouteResults;
