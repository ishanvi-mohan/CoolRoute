import type { RouteComparison, Route } from '../types/route';

interface RouteResultsProps {
  comparison: RouteComparison | null;
  isCalculating: boolean;
  error?: string;
  selectedRoute: 'shaded' | 'shortest';
  onSelectRoute: (route: 'shaded' | 'shortest') => void;
  onRecalculate?: () => void;
}

const getShadeConfig = (coverage: number) => {
  if (coverage >= 70) return { label: 'Excellent', color: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (coverage >= 50) return { label: 'Good',      color: 'text-teal-600',    bar: 'bg-teal-500' };
  if (coverage >= 30) return { label: 'Moderate',  color: 'text-amber-600',   bar: 'bg-amber-400' };
  return                     { label: 'Limited',   color: 'text-orange-600',  bar: 'bg-orange-400' };
};

const getUVConfig = (uv: number) => {
  if (uv <= 2) return { label: 'Low',       color: 'text-green-600',  bg: 'bg-green-50  border-green-200' };
  if (uv <= 5) return { label: 'Moderate',  color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
  if (uv <= 7) return { label: 'High',      color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  return               { label: 'Very High',color: 'text-red-600',    bg: 'bg-red-50    border-red-200' };
};

function fmt(metres: number) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(2)} km`
    : `${Math.round(metres)} m`;
}

interface RouteCardProps {
  label: string;
  badge?: string;
  badgeColor?: string;
  route: Route;
  active: boolean;
  lineColor: string;
  onClick: () => void;
}

const RouteCard = ({ label, badge, badgeColor, route, active, lineColor, onClick }: RouteCardProps) => {
  const shade = getShadeConfig(route.shadeCoverage);
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left rounded-2xl border-2 p-4 transition-all duration-150',
        active
          ? 'border-current shadow-md scale-[1.01]'
          : 'border-gray-100 bg-gray-50 hover:border-gray-200',
      ].join(' ')}
      style={active ? { borderColor: lineColor, background: `${lineColor}08` } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Coloured line indicator */}
          <div className="flex items-center gap-0.5">
            <div className="w-5 h-1.5 rounded-full" style={{ background: lineColor }} />
            <div className="w-2 h-1.5 rounded-full opacity-50" style={{ background: lineColor }} />
          </div>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badge}
            </span>
          )}
          {active && (
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: lineColor }}>
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-gray-400 font-medium">Distance</p>
          <p className="text-sm font-bold text-gray-900">{fmt(route.totalDistance)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-medium">Walk time</p>
          <p className="text-sm font-bold text-gray-900">{Math.round(route.estimatedTime)} min</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-medium">Shade</p>
          <p className={`text-sm font-bold ${shade.color}`}>{route.shadeCoverage}%</p>
        </div>
      </div>

      {/* Shade bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${shade.bar}`}
          style={{ width: `${route.shadeCoverage}%` }}
        />
      </div>
      <p className={`text-[10px] font-medium mt-1 ${shade.color}`}>{shade.label} shade coverage</p>
    </button>
  );
};

const RouteResults = ({
  comparison,
  isCalculating,
  error,
  selectedRoute,
  onSelectRoute,
  onRecalculate,
}: RouteResultsProps) => {
  if (error) {
    return (
      <div className="px-5 pb-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-red-800 text-sm">Route unavailable</p>
              <p className="text-red-600 text-xs mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              className="mt-3 w-full h-10 bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm rounded-xl transition-colors"
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
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Calculating routes</p>
              <p className="text-emerald-600 text-xs mt-1">Analysing sun position & building shadows…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  const { shadedRoute, shortestRoute, isSameRoute } = comparison;
  const active = selectedRoute === 'shaded' ? shadedRoute : shortestRoute;
  const uv = getUVConfig(active.uvIndex);

  // How much shade the shaded route gains vs shortest
  const shadeDiff = shadedRoute.shadeCoverage - shortestRoute.shadeCoverage;
  const distDiff  = shadedRoute.totalDistance - shortestRoute.totalDistance;

  return (
    <div className="px-5 pb-safe pb-6 space-y-3">
      <div className="h-px bg-gray-100" />

      {/* Route picker */}
      {isSameRoute ? (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
          <p className="text-xs text-blue-700 font-medium">
            The shadiest route is also the shortest — no detour needed 🎉
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Choose your route
          </p>
          <div className="space-y-2">
            <RouteCard
              label="Shadiest Route"
              badge={shadeDiff > 0 ? `+${shadeDiff}% shade` : undefined}
              badgeColor="bg-emerald-100 text-emerald-700"
              route={shadedRoute}
              active={selectedRoute === 'shaded'}
              lineColor="#10b981"
              onClick={() => onSelectRoute('shaded')}
            />
            <RouteCard
              label="Shortest Route"
              badge={distDiff > 0 ? `${fmt(distDiff)} shorter` : undefined}
              badgeColor="bg-blue-100 text-blue-700"
              route={shortestRoute}
              active={selectedRoute === 'shortest'}
              lineColor="#3b82f6"
              onClick={() => onSelectRoute('shortest')}
            />
          </div>
        </div>
      )}

      {/* Selected route details */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Selected route details
        </p>

        {/* UV index */}
        <div className={`rounded-2xl p-3.5 border ${uv.bg} flex items-center justify-between`}>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">UV Index</p>
            <p className={`text-xl font-bold mt-0.5 ${uv.color}`}>
              {active.uvIndex.toFixed(1)}
              <span className={`text-sm font-medium ml-1.5 ${uv.color}`}>{uv.label}</span>
            </p>
          </div>
          <span className="text-2xl">☀️</span>
        </div>

        {/* Detour note */}
        {active.detourDistance > 0 && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-2xl p-3 mt-2">
            <span className="text-blue-400 text-sm mt-0.5">ℹ</span>
            <p className="text-xs text-blue-700 leading-relaxed">
              <span className="font-semibold">{fmt(active.detourDistance)} longer</span> than the shortest path for better shade.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 py-1 px-2.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            Recalculate
          </button>
        )}
      </div>
    </div>
  );
};

export default RouteResults;
