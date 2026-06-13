import { useState, useRef, useCallback } from 'react';
import Map from './components/Map';
import NavigationHUD from './components/NavigationHUD';
import { SearchScreen } from './components/SearchScreen';
import { RouteSelectionScreen } from './components/RouteSelectionScreen';
import { calculateRoute } from './services/api';
import type { Location } from './types/location';
import type { Route, RouteComparison } from './types/route';

type Screen = 'search' | 'routes' | 'navigation';

function routeToLatLngs(route: Route | undefined) {
  if (route?.polyline?.length) return route.polyline;
  if (!route?.segments?.length) return [];
  return route.segments.flatMap((s) => [
    { lat: s.start.lat, lng: s.start.lng },
    { lat: s.end.lat,   lng: s.end.lng   },
  ]);
}

function App() {
  const [screen,        setScreen]        = useState<Screen>('search');
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [destLocation,  setDestLocation]  = useState<Location | null>(null);
  const [comparison,    setComparison]    = useState<RouteComparison | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<'shaded' | 'shortest'>('shaded');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error,         setError]         = useState<string | undefined>();
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const mapRef        = useRef<any>(null);
  const polylinesRef  = useRef<any[]>([]);
  const markersRef    = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  const handleMapLoad = useCallback((map: any) => { mapRef.current = map; }, []);

  const handleNavigationPosition = useCallback((pos: Location, heading: number | null) => {
    const map = mapRef.current;
    if (!map) return;
    const g = (window as any).google;
    const p = { lat: pos.lat, lng: pos.lng };

    // Live "you are here" dot that follows the device, like Google Maps.
    if (g) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new g.maps.Marker({
          position: p,
          map,
          zIndex: 30,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            fillColor: '#1a5fb4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
            scale: 8,
          },
        });
      } else {
        userMarkerRef.current.setPosition(p);
      }
    }

    map.panTo(p);
    if (heading !== null && g) map.setHeading(heading);
    if (map.getZoom() < 17) map.setZoom(17);
  }, []);

  const clearUserMarker = useCallback(() => {
    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null; }
  }, []);

  function clearMapOverlays() {
    polylinesRef.current.forEach((p) => p.setMap(null)); polylinesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));   markersRef.current   = [];
  }

  function drawRoutes(map: any, comp: RouteComparison, active: 'shaded' | 'shortest') {
    clearMapOverlays();
    const g = (window as any).google;
    if (!g) return;

    const shadedPath   = routeToLatLngs(comp.shadedRoute);
    const shortestPath = routeToLatLngs(comp.shortestRoute);

    if (!comp.isSameRoute) {
      const bgPath  = active === 'shaded' ? shortestPath : shadedPath;
      const bgColor = active === 'shaded' ? '#94a3b8' : '#1a5fb4';
      polylinesRef.current.push(new g.maps.Polyline({
        path: bgPath, strokeColor: bgColor, strokeWeight: 4, strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.4, strokeColor: bgColor, scale: 3 }, offset: '0', repeat: '14px' }],
        map,
      }));
    }

    const fgPath  = active === 'shaded' ? shadedPath : shortestPath;
    const fgColor = active === 'shaded' ? '#1a5fb4' : '#0ea5b0';
    polylinesRef.current.push(new g.maps.Polyline({ path: fgPath, strokeColor: fgColor, strokeWeight: 5, strokeOpacity: 0.9, map }));

    // Start point shown as a hollow origin ring — the solid blue dot is the
    // live current-location marker that tracks the device during navigation.
    if (startLocation) {
      markersRef.current.push(new g.maps.Marker({
        position: { lat: startLocation.lat, lng: startLocation.lng }, map,
        icon: { path: g.maps.SymbolPath.CIRCLE, fillColor: '#fff', fillOpacity: 1, strokeColor: '#1a5fb4', strokeWeight: 3, scale: 6 }, zIndex: 9,
      }));
    }
    if (destLocation) {
      markersRef.current.push(new g.maps.Marker({
        position: { lat: destLocation.lat, lng: destLocation.lng }, map,
        icon: { path: g.maps.SymbolPath.CIRCLE, fillColor: '#0d1520', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 9 }, zIndex: 10,
      }));
    }

    const bounds = new g.maps.LatLngBounds();
    fgPath.forEach((p: any) => bounds.extend(p));
    if (!comp.isSameRoute) {
      (active === 'shaded' ? shortestPath : shadedPath).forEach((p: any) => bounds.extend(p));
    }
    map.fitBounds(bounds, { top: 80, bottom: 320, left: 40, right: 40 });
  }

  const handleSearch = async (start: Location, dest: Location) => {
    setStartLocation(start);
    setDestLocation(dest);
    setIsCalculating(true);
    setError(undefined);
    setComparison(null);
    setSelectedRoute('shaded');

    try {
      const result = await calculateRoute({ start, destination: dest, timestamp: new Date() });
      setComparison(result);
      setScreen('routes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate route');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectRoute = (route: 'shaded' | 'shortest') => {
    setSelectedRoute(route);
    setScreen('navigation');
    // Draw route on map after a tick (map needs to be visible first)
    setTimeout(() => {
      if (mapRef.current && comparison) drawRoutes(mapRef.current, comparison, route);
    }, 100);
  };

  const activeRoute = (): Route | null => {
    if (!comparison) return null;
    return selectedRoute === 'shaded' ? comparison.shadedRoute : comparison.shortestRoute;
  };

  return (
    <div className="relative w-screen overflow-hidden" style={{ height: '100dvh' }}>

      {/* Map — always mounted so it stays loaded; only visible during navigation */}
      <div className={`absolute inset-0 ${screen === 'navigation' ? 'z-0' : '-z-10 invisible'}`}>
        <Map onMapLoad={handleMapLoad} />
      </div>

      {/* ── Screen 1: Search ── */}
      {screen === 'search' && (
        <div className="absolute inset-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <SearchScreen
            onSearch={handleSearch}
            isCalculating={isCalculating}
            error={error}
          />
        </div>
      )}

      {/* ── Screen 2: Route selection ── */}
      {screen === 'routes' && comparison && (
        <div className="absolute inset-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <RouteSelectionScreen
            comparison={comparison}
            fromName={startLocation?.name ?? 'Start'}
            toName={destLocation?.name ?? 'Destination'}
            onBack={() => setScreen('search')}
            onSelect={handleSelectRoute}
          />
        </div>
      )}

      {/* ── Screen 3: Navigation (map + bottom HUD) ── */}
      {screen === 'navigation' && activeRoute() && (
        <div
          className={`absolute left-0 right-0 bottom-0 flex flex-col rounded-t-3xl overflow-hidden transition-[height] duration-300 ease-out ${sheetExpanded ? 'h-[82dvh]' : 'h-[22dvh]'}`}
          style={{ background: '#fff', boxShadow: '0 -4px 40px rgba(13,21,32,0.12)', zIndex: 10 }}
        >
          {/* Grab handle — tap to expand/collapse. Collapsed, the map fills ~78%. */}
          <button
            onClick={() => setSheetExpanded((v) => !v)}
            className="flex flex-col items-center gap-1 pt-2.5 pb-1.5 flex-shrink-0"
            aria-label={sheetExpanded ? 'Collapse details' : 'Expand details'}
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--muted-foreground)', opacity: 0.4 }} />
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sheetExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                <path d="M18 15l-6-6-6 6" />
              </svg>
              {sheetExpanded ? 'Hide' : 'Details'}
            </span>
          </button>

          {/* NavigationHUD fills the sheet (it scrolls internally) */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <NavigationHUD
              route={activeRoute()!}
              onStop={() => {
                clearUserMarker();
                setSheetExpanded(false);
                setScreen('search');
                if (mapRef.current) mapRef.current.setHeading(0);
              }}
              onPositionUpdate={handleNavigationPosition}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
