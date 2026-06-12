import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
}

const Map = ({ onMapLoad }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.current.addControl(geolocateControl, 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      if (onMapLoad && map.current) onMapLoad(map.current);
      geolocateControl.trigger();
    });

    // Resize map when its container changes dimensions
    // (critical: fixes the half-black-map issue on first render)
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    if (mapContainer.current) resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [onMapLoad]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
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
