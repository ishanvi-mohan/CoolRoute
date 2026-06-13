import { useEffect, useRef, useState } from 'react';

interface MapProps {
  onMapLoad?: (map: any) => void;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Module-level loading state so multiple Map instances share one script load
let _scriptLoaded = false;
let _scriptLoading = false;
const _pendingCallbacks: Array<() => void> = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (_scriptLoaded) { resolve(); return; }
    _pendingCallbacks.push(resolve);
    if (_scriptLoading) return;
    _scriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _scriptLoaded = true;
      _pendingCallbacks.forEach((cb) => cb());
      _pendingCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

const Map = ({ onMapLoad }: MapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;

    loadGoogleMaps().then(() => {
      if (mapRef.current || !containerRef.current) return;

      const g = (window as any).google;
      const map = new g.maps.Map(containerRef.current, {
        center: { lat: 22.3193, lng: 114.1694 }, // Hong Kong default
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy', // single-finger pan on mobile
        zoomControlOptions: {
          position: g.maps.ControlPosition.RIGHT_TOP,
        },
      });

      mapRef.current = map;
      setMapLoaded(true);
      onMapLoad?.(map);

      // Pan to user's location and add blue dot
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.setCenter(latLng);
            new g.maps.Marker({
              position: latLng,
              map,
              title: 'Your location',
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8,
              },
              zIndex: 999,
            });
          },
          undefined,
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    });

    return () => {
      // Don't destroy the map on cleanup — just clear the ref
      // so Strict Mode's second run can reinitialise cleanly
      mapRef.current = null;
    };
  }, [onMapLoad]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-50 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          <p className="text-sm text-emerald-700 font-medium">Loading map…</p>
        </div>
      )}
    </div>
  );
};

export default Map;
