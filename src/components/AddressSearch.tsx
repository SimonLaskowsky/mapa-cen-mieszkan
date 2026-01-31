'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface AddressSearchProps {
  cityName: string;
  onLocationFound: (result: SearchResult) => void;
  onClear: () => void;
}

export default function AddressSearch({ cityName, onLocationFound, onClear }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur();
        setQuery('');
        onClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, onClear]);

  const searchAddress = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // Use Nominatim (OSM) for geocoding - free, no API key needed
      const searchQuery = `${query}, ${cityName}, Poland`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MapaCenMieszkan/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.length === 0) {
        setError('LOCATION NOT FOUND');
        return;
      }

      const result = data[0];
      onLocationFound({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      });
    } catch (err) {
      setError('SEARCH ERROR');
      console.error('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchAddress();
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    onClear();
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`
            tactical-panel rounded-lg overflow-hidden transition-all duration-200
            ${isFocused ? 'ring-1 ring-[#00d4aa40]' : ''}
            ${error ? 'ring-1 ring-red-500/40' : ''}
          `}
        >
          <div className="flex items-center">
            {/* Search icon / status */}
            <div className="pl-3 pr-2 flex items-center justify-center">
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className={`w-4 h-4 ${error ? 'text-red-400' : 'text-[#00d4aa]'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="SEARCH ADDRESS..."
              className="
                flex-1 bg-transparent border-none outline-none
                font-mono text-xs text-white placeholder-gray-600
                py-2.5 pr-2
              "
            />

            {/* Keyboard shortcut hint */}
            {!query && !isFocused && (
              <div className="pr-3 flex items-center gap-1">
                <kbd className="font-mono text-[10px] text-gray-600 bg-[#ffffff08] px-1.5 py-0.5 rounded border border-[#ffffff10]">
                  ⌘K
                </kbd>
              </div>
            )}

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="pr-3 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute top-full left-0 mt-1 px-3 py-1.5 tactical-panel rounded text-xs font-mono text-red-400">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
