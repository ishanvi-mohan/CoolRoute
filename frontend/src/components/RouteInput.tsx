import { useState, useEffect } from 'react';
import SearchBox from './SearchBox';
import type { Location } from '../types/location';

interface RouteInputProps {
  onStartChange: (location: Location) => void;
  onDestinationChange: (location: Location) => void;
  onCalculateRoute: () => void;
  isCalculating?: boolean;
}

const RouteInput = ({
  onStartChange,
  onDestinationChange,
  onCalculateRoute,
  isCalculating = false,
}: RouteInputProps) => {
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [destLocation,  setDestLocation]  = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported.');
      return;
    }
    setGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Current Location',
        };
        setStartLocation(location);
        onStartChange(location);
        setGettingLocation(false);
      },
      () => {
        setLocationError('Enable location services to use your current position.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleDestSelect = (location: Location) => {
    setDestLocation(location);
    onDestinationChange(location);
  };

  const canCalculate = startLocation && destLocation && !isCalculating;

  return (
    <div className="px-5 py-4 space-y-1">
      {/* Origin */}
      <div className="flex items-center gap-3 h-12 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {gettingLocation ? (
            <span className="text-sm text-gray-400">Locating you…</span>
          ) : startLocation ? (
            <span className="text-sm font-medium text-gray-700">Current Location</span>
          ) : locationError ? (
            <span className="text-sm text-red-500 truncate">{locationError}</span>
          ) : (
            <span className="text-sm text-gray-400">Location unavailable</span>
          )}
        </div>
        <button
          onClick={getCurrentLocation}
          disabled={gettingLocation}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 flex-shrink-0 py-1 px-2 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          {gettingLocation ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : '↺'}
        </button>
      </div>

      {/* Connector */}
      <div className="flex items-center gap-3 h-4 pl-[21px]">
        <div className="w-px h-full bg-gray-200" />
      </div>

      {/* Destination */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-sm bg-red-400 rotate-45 flex-shrink-0" />
        <div className="flex-1">
          <SearchBox
            placeholder="Where do you want to go?"
            proximity={startLocation}
            onSelect={handleDestSelect}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="pt-3">
        <button
          onClick={onCalculateRoute}
          disabled={!canCalculate}
          className={[
            'w-full h-12 rounded-xl font-semibold text-sm transition-all duration-200',
            canCalculate
              ? 'bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white shadow-sm shadow-emerald-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          {isCalculating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Finding shadiest route…
            </span>
          ) : (
            'Find Shady Route'
          )}
        </button>
      </div>

      {startLocation && destLocation && !isCalculating && (
        <p className="text-center text-xs text-gray-400 pt-1">
          Max 20% longer than shortest path
        </p>
      )}
    </div>
  );
};

export default RouteInput;
