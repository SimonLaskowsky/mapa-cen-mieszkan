'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
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
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && isFocused) {
        if (showDropdown) {
          setShowDropdown(false);
          setResults([]);
        } else {
          inputRef.current?.blur();
          setQuery('');
          onClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, onClear, showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchResults = useCallback(async (searchText: string) => {
    if (!searchText.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchQuery = `${searchText}, ${cityName}, Poland`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MapaCenMieszkan/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: NominatimResult[] = await response.json();
      setResults(data);
      setShowDropdown(true);
      setHighlightedIndex(-1);

      if (data.length === 0) {
        setError(null); // Error shown inline in dropdown as "No results found"
      }
    } catch (err) {
      setError('SEARCH ERROR');
      setResults([]);
      setShowDropdown(false);
      console.error('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [cityName]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Skip fetch after selecting a result (query changed but we don't want to re-search)
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchResults(query);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, fetchResults]);

  const skipNextFetchRef = useRef(false);

  const selectResult = (result: NominatimResult) => {
    onLocationFound({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    });
    skipNextFetchRef.current = true;
    setQuery(result.display_name.split(',')[0]);
    setShowDropdown(false);
    setResults([]);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      const index = highlightedIndex >= 0 ? highlightedIndex : 0;
      selectResult(results[index]);
    } else if (query.trim()) {
      // If no results yet, trigger a fetch and select the first result
      fetchResults(query).then(() => {
        // Results will be available via state after re-render, handled by the effect
      });
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectResult(results[highlightedIndex]);
    }
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    setResults([]);
    setShowDropdown(false);
    onClear();
  };

  const truncateDisplayName = (name: string, maxLength: number = 60) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
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
              onBlur={() => {
                setIsFocused(false);
              }}
              onKeyDown={handleInputKeyDown}
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

        {/* Error message (only shown when dropdown is not visible) */}
        {error && !showDropdown && (
          <div className="absolute top-full left-0 mt-1 px-3 py-1.5 tactical-panel rounded text-xs font-mono text-red-400">
            {error}
          </div>
        )}
      </form>

      {/* Autocomplete dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-[rgba(10,18,24,0.95)] border border-[#00d4aa30] rounded-lg overflow-hidden shadow-lg"
        >
          {isSearching && results.length === 0 && (
            <div className="px-3 py-2.5 font-mono text-xs text-gray-500 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {!isSearching && results.length === 0 && (
            <div className="px-3 py-2.5 font-mono text-xs text-gray-500">
              No results found
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.lat}-${result.lon}-${index}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur before click registers
                selectResult(result);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                w-full text-left px-3 py-2 font-mono text-xs transition-colors cursor-pointer
                ${
                  highlightedIndex === index
                    ? 'bg-[#00d4aa15] text-[#00d4aa]'
                    : 'text-gray-300 hover:bg-[#00d4aa10] hover:text-white'
                }
                ${index < results.length - 1 ? 'border-b border-[#00d4aa10]' : ''}
              `}
            >
              {truncateDisplayName(result.display_name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
