/**
 * Destination search using Google Places Autocomplete API (New).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Location } from '../types/location';

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface SearchBoxProps {
  placeholder?: string;
  proximity?: { lat: number; lng: number } | null;
  onSelect: (location: Location) => void;
  /** When true, renders without a search icon — for embedding inside a row */
  compact?: boolean;
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';

export default function SearchBox({
  placeholder = 'Where do you want to go?',
  proximity,
  onSelect,
  compact = false,
}: SearchBoxProps) {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggest = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { input: q };
      if (proximity) {
        body.locationBias = {
          circle: { center: { latitude: proximity.lat, longitude: proximity.lng }, radius: 50000 },
        };
      }
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': [
            'suggestions.placePrediction.placeId',
            'suggestions.placePrediction.structuredFormat',
          ].join(','),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Autocomplete failed');
      const data = await res.json();
      const items: PlaceSuggestion[] = (data.suggestions ?? []).map((s: any) => {
        const p = s.placePrediction;
        return {
          placeId:       p.placeId,
          mainText:      p.structuredFormat?.mainText?.text      ?? p.text?.text ?? '',
          secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        };
      });
      setSuggestions(items);
      setOpen(items.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [proximity]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => suggest(val), 250);
  };

  const retrieve = async (suggestion: PlaceSuggestion) => {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}`,
        { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': 'location,displayName,formattedAddress' } }
      );
      if (!res.ok) throw new Error('Place details failed');
      const data = await res.json();
      const { latitude: lat, longitude: lng } = data.location;
      const name = data.formattedAddress || data.displayName?.text || suggestion.mainText;
      setQuery(suggestion.mainText);
      setSuggestions([]);
      setOpen(false);
      onSelect({ lat, lng, name });
    } catch (err) {
      console.error('Place details fetch failed:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); retrieve(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        {!compact && (
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        )}

        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent outline-none text-sm"
          style={{
            color: 'var(--foreground)',
            paddingLeft: compact ? 0 : '2rem',
            paddingRight: query ? '1.5rem' : 0,
          }}
        />

        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-0.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {loading && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {/* Dropdown — rendered outside the row via absolute positioning */}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-2 w-full rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(13,21,32,0.12)' }}
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); retrieve(s); }}
                className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors"
                style={{ background: i === activeIdx ? 'var(--secondary)' : 'transparent' }}
              >
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{s.mainText}</p>
                  {s.secondaryText && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{s.secondaryText}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div
          className="absolute z-50 mt-2 w-full rounded-2xl px-4 py-3"
          style={{ background: '#fff', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
