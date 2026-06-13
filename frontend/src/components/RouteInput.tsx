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
  const [startLocation,   setStartLocation]   = useState<Location | null>(null);
  const [destLocation,    setDestLocation]     = useState<Location | null>(null);
  const [locationError,   setLocationError]    = useState<string | null>(null);
  const [gettingLocation, setGettingLocation]  = useState(false);
  const [startMode,       setStartMode]        = useState<'gps' | 'manual'>('gps');

  useEffect(() => {
    if (startMode === 'gps') getCurrentLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMode]);

  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported.');
      return;
    }
    setGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Current Location',
        };
        setStartLocation(loc);
        onStartChange(loc);
        setGettingLocation(false);
      },
      () => {
        setLocationError('Enable location services to use your current position.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartSelect = (loc: Location) => {
    setStartLocation(loc);
    onStartChange(loc);
  };

  const handleDestSelect = (loc: Location) => {
    setDestLocation(loc);
    onDestinationChange(loc);
  };

  const canCalculate = startLocation && destLocation && !isCalculating;

  return (
    <div className="px-5 py-4 space-y-2">

      {/* Input card */}
      <div className="rounded-2xl" style={{ border: '1px solid var(--border)', background: '#fff', boxShadow: '0 1px 4px rgba(26,95,180,0.06)' }}>

        {/* Origin row */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--secondary)' }}
          >
            {gettingLocation ? (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--primary)" strokeWidth="4" opacity="0.25" />
                <path fill="var(--primary)" opacity="0.75" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>FROM</p>
            {startMode === 'gps' ? (
              <p className="text-sm truncate" style={{ color: locationError ? '#d4183d' : 'var(--foreground)', fontWeight: 500 }}>
                {gettingLocation ? 'Locating you…' : locationError ? locationError : startLocation ? 'Current Location' : 'Location unavailable'}
              </p>
            ) : (
              <SearchBox
                placeholder="Starting point"
                proximity={destLocation}
                onSelect={handleStartSelect}
                compact
              />
            )}
          </div>

          {startMode === 'gps' ? (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                title="Refresh"
                className="p-1.5 rounded-lg disabled:opacity-40 transition-opacity"
                style={{ color: 'var(--primary)' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3.51 15a9 9 0 1 0 .49-5.5L1 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => { setStartMode('manual'); setStartLocation(null); }}
                className="text-xs font-medium py-1 px-2 rounded-lg"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Edit
              </button>
            </div>
          ) : (
            <button
              onClick={() => setStartMode('gps')}
              title="Use current location"
              className="flex-shrink-0 p-1.5 rounded-lg"
              style={{ color: 'var(--primary)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Destination row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>TO</p>
            <SearchBox
              placeholder="Where to?"
              proximity={startLocation}
              onSelect={handleDestSelect}
              compact
            />
          </div>
        </div>
      </div>

      {/* CTA button */}
      <button
        onClick={onCalculateRoute}
        disabled={!canCalculate}
        className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
        style={{
          background: canCalculate ? 'var(--primary)' : 'var(--muted)',
          color: canCalculate ? '#fff' : 'var(--muted-foreground)',
          fontWeight: 500,
          boxShadow: canCalculate ? '0 4px 24px rgba(26,95,180,0.3)' : 'none',
          cursor: !canCalculate ? 'not-allowed' : 'pointer',
        }}
      >
        {isCalculating ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
              <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Finding shadiest route…
          </>
        ) : (
          <>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7" />
            </svg>
            Find Shaded Route
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>

      {/* Time chip */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Shade calculated for <strong style={{ color: 'var(--foreground)' }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} today</strong> · Max 20% detour
        </p>
      </div>
    </div>
  );
};

export default RouteInput;
