/**
 * Custom destination search using Mapbox Search Box API v1.
 * Replaces @mapbox/mapbox-gl-geocoder which uses the older v5 Geocoding API
 * and has much poorer POI / address coverage.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Location } from '../types/location';

interface Suggestion {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  feature_type: string;
}

interface SearchBoxProps {
  placeholder?: string;
  proximity?: { lat: number; lng: number } | null;
  onSelect: (location: Location) => void;
}

const SESSION_TOKEN = crypto.randomUUID();

export default function SearchBox({
  placeholder = 'Where do you want to go?',
  proximity,
  onSelect,
}: SearchBoxProps) {
  const [query, setQuery]             = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const [, setSelected]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggest = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        access_token: token,
        session_token: SESSION_TOKEN,
        limit: '10',
        language: navigator.language,
        // All feature types for maximum coverage
        types: 'country,region,district,postcode,locality,place,neighborhood,street,address,poi,poi.landmark,poi.restaurant,poi.hotel',
        ...(proximity ? { proximity: `${proximity.lng},${proximity.lat}` } : {}),
      });

      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`
      );
      if (!res.ok) throw new Error('Suggest failed');
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen(true);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [token, proximity]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => suggest(val), 250);
  };

  const retrieve = async (suggestion: Suggestion) => {
    try {
      const params = new URLSearchParams({
        access_token: token,
        session_token: SESSION_TOKEN,
      });
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?${params}`
      );
      if (!res.ok) throw new Error('Retrieve failed');
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return;

      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const name = feature.properties?.full_address || suggestion.full_address || suggestion.name;

      setQuery(suggestion.name);
      setSelected(name);
      setSuggestions([]);
      setOpen(false);
      onSelect({ lat, lng, name });
    } catch {
      // silently fail
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      retrieve(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const featureIcon = (type: string) => {
    if (type.startsWith('poi')) return '📍';
    if (type === 'address' || type === 'street') return '🏠';
    if (type === 'place' || type === 'locality') return '🏙️';
    if (type === 'neighborhood') return '🗺️';
    return '📌';
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={[
            'w-full pl-9 pr-9 py-[11px] text-[15px] rounded-xl border-[1.5px]',
            'bg-gray-50 text-gray-900 placeholder-gray-400',
            'focus:outline-none focus:bg-white transition-colors',
            open ? 'border-emerald-500 ring-[3px] ring-emerald-500/10' : 'border-gray-200',
          ].join(' ')}
        />

        {/* Spinner / clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          ) : query ? (
            <button
              onMouseDown={(e) => { e.preventDefault(); setQuery(''); setSuggestions([]); setOpen(false); setSelected(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={s.mapbox_id}>
              <button
                onMouseDown={(e) => { e.preventDefault(); retrieve(s); }}
                className={[
                  'w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors',
                  i === activeIdx ? 'bg-emerald-50' : 'hover:bg-gray-50',
                  i > 0 ? 'border-t border-gray-100' : '',
                ].join(' ')}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{featureIcon(s.feature_type)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  {(s.place_formatted || s.full_address) && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {s.place_formatted || s.full_address}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No results hint */}
      {open && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-xl px-4 py-3">
          <p className="text-sm text-gray-400">No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
