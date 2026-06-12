import { useState, useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import Map from './components/Map';
import RouteInput from './components/RouteInput';
import RouteResults from './components/RouteResults';
import { calculateRoute } from './services/api';
import type { Location } from './types/location';
import type { Route, RouteComparison } from './types/route';

const SHADED_LAYER   = 'shaded-route-layer';
const SHADED_SOURCE  = 'shaded-route-source';
const SHORTEST_LAYER  = 'shortest-route-layer';
const SHORTEST_SOURCE = 'shortest-route-source';

function routeToCoords(route: Route | undefined): [number, number][] {
  if (!route?.segments?.length) return [];
  return route.segments.flatMap((s) => [
    [s.start.lng, s.start.lat],
    [s.end.lng,   s.end.lat],
  ]);
}

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  const [startLocation, setStartLocation]   = useState<Location | null>(null);
  const [destLocation,  setDestLocation]    = useState<Location | null>(null);
  const [comparison,    setComparison]      = useState<RouteComparison | null>(null);
  const [selectedRoute, setSelectedRoute]   = useState<'shaded' | 'shortest'>('shaded');
  const [isCalculating, setIsCalculating]   = useState(false);
  const [error,         setError]           = useState<string | undefined>();
  const [panelExpanded, setPanelExpanded]   = useState(false);

  const mapRef      = useRef<mapboxgl.Map | null>(null);
  const markersRef  = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (comparison || error) setPanelExpanded(true);
  }, [comparison, error]);

  const handleMapLoad = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
  }, []);

  // Re-draw whenever the user switches routes
  useEffect(() => {
    if (!comparison || !mapRef.current) return;
    drawRoutes(mapRef.current, comparison, selectedRoute);
  }, [selectedRoute, comparison]);

  function clearMapRoutes(map: mapboxgl.Map) {
    [SHADED_LAYER, SHORTEST_LAYER].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    [SHADED_SOURCE, SHORTEST_SOURCE].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }

  function drawRoutes(
    map: mapboxgl.Map,
    comp: RouteComparison,
    active: 'shaded' | 'shortest'
  ) {
    clearMapRoutes(map);

    const shadedCoords   = routeToCoords(comp.shadedRoute);
    const shortestCoords = routeToCoords(comp.shortestRoute);

    // Draw the non-selected route first (behind)
    if (!comp.isSameRoute) {
      const bgRoute   = active === 'shaded' ? comp.shortestRoute : comp.shadedRoute;
      const bgCoords  = active === 'shaded' ? shortestCoords : shadedCoords;
      const bgSource  = active === 'shaded' ? SHORTEST_SOURCE : SHADED_SOURCE;
      const bgLayer   = active === 'shaded' ? SHORTEST_LAYER  : SHADED_LAYER;
      const bgColor   = active === 'shaded' ? '#94a3b8' : '#10b981'; // slate / emerald

      map.addSource(bgSource, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: bgCoords } },
      });
      map.addLayer({
        id: bgLayer, type: 'line', source: bgSource,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': bgColor, 'line-width': 4, 'line-opacity': 0.4, 'line-dasharray': [2, 2] },
      });

      void bgRoute; // suppress unused var warning
    }

    // Draw the active route on top
    const fgCoords = active === 'shaded' ? shadedCoords : shortestCoords;
    const fgSource = active === 'shaded' ? SHADED_SOURCE  : SHORTEST_SOURCE;
    const fgLayer  = active === 'shaded' ? SHADED_LAYER   : SHORTEST_LAYER;
    const fgColor  = active === 'shaded' ? '#10b981' : '#3b82f6'; // emerald / blue

    map.addSource(fgSource, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: fgCoords } },
    });
    map.addLayer({
      id: fgLayer, type: 'line', source: fgSource,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': fgColor, 'line-width': 5, 'line-opacity': 0.9 },
    });

    // Markers
    if (startLocation) {
      const m = new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([startLocation.lng, startLocation.lat])
        .addTo(map);
      markersRef.current.push(m);
    }
    if (destLocation) {
      const m = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([destLocation.lng, destLocation.lat])
        .addTo(map);
      markersRef.current.push(m);
    }

    // Fit bounds to the active route
    const bounds = new mapboxgl.LngLatBounds();
    fgCoords.forEach((c) => bounds.extend(c));
    if (!comp.isSameRoute) {
      const bgCoords2 = active === 'shaded' ? shortestCoords : shadedCoords;
      bgCoords2.forEach((c) => bounds.extend(c));
    }
    map.fitBounds(bounds, { padding: { top: 80, bottom: 320, left: 60, right: 60 } });
  }

  const handleCalculateRoute = async () => {
    if (!startLocation || !destLocation) return;
    setIsCalculating(true);
    setError(undefined);
    setComparison(null);
    setSelectedRoute('shaded');
    setPanelExpanded(true);

    try {
      const result = await calculateRoute({
        start: startLocation,
        destination: destLocation,
        timestamp: new Date(),
      });
      setComparison(result);
      if (mapRef.current) drawRoutes(mapRef.current, result, 'shaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate route');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectRoute = (route: 'shaded' | 'shortest') => {
    setSelectedRoute(route);
  };

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-screen bg-emerald-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-sm mx-4">
          <div className="text-4xl mb-3">🌳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Coolroute</h1>
          <p className="text-gray-500 text-sm mb-4">
            Add your Mapbox token to <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env</code>
          </p>
          <pre className="text-left bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-700">
            VITE_MAPBOX_ACCESS_TOKEN=pk...
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen overflow-hidden bg-gray-200" style={{ height: '100dvh' }}>
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <Map onMapLoad={handleMapLoad} />
      </div>

      {/* Panel: bottom sheet (mobile) / left sidebar (desktop) */}
      <div
        className={[
          'absolute bg-white flex flex-col overflow-hidden z-10',
          'left-0 right-0 bottom-0',
          'rounded-t-3xl shadow-[0_-4px_40px_rgba(0,0,0,0.18)]',
          'transition-[max-height] duration-300 ease-in-out',
          panelExpanded ? 'max-h-[88dvh] max-h-[88vh]' : 'max-h-[52dvh] max-h-[52vh]',
          'md:top-0 md:bottom-0 md:left-0 md:right-auto md:w-[380px]',
          'md:rounded-none md:rounded-r-2xl',
          'md:shadow-[4px_0_40px_rgba(0,0,0,0.12)]',
          'md:max-h-none',
        ].join(' ')}
      >
        {/* Drag handle (mobile) */}
        <div
          className="flex justify-center pt-3 pb-1 md:hidden cursor-pointer flex-shrink-0"
          onClick={() => setPanelExpanded((v) => !v)}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Branding */}
        <div className="px-5 pt-1 pb-3 md:pt-6 md:pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🌳</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Coolroute</h1>
              <p className="text-xs text-gray-400">Shade-optimized pedestrian routing</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <RouteInput
            onStartChange={setStartLocation}
            onDestinationChange={setDestLocation}
            onCalculateRoute={handleCalculateRoute}
            isCalculating={isCalculating}
          />

          {(comparison || isCalculating || error) && (
            <RouteResults
              comparison={comparison}
              isCalculating={isCalculating}
              error={error}
              selectedRoute={selectedRoute}
              onSelectRoute={handleSelectRoute}
              onRecalculate={handleCalculateRoute}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
