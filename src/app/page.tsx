'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Legend from '@/components/Legend';
import StatsPanel from '@/components/StatsPanel';
import ListingsPanel from '@/components/ListingsPanel';
import CitySelector from '@/components/CitySelector';
import TrendChart from '@/components/TrendChart';
import ListingDetail from '@/components/ListingDetail';
import AddressSearch from '@/components/AddressSearch';
import CountUp from '@/components/CountUp';
import { CITIES } from '@/lib/cities';
import { type DistrictStats } from '@/lib/city-data';
import { useViewportDistricts, type Bbox } from '@/lib/useViewportDistricts';
import { useSoundEffects } from '@/lib/useSoundEffects';
import { useDebounce } from '@/lib/useDebounce';

interface SearchLocation {
  lat: number;
  lng: number;
  displayName: string;
}

interface SelectedListing {
  id: string;
  lat: number;
  lng: number;
  price: number;
  sizeM2: number;
  pricePerM2: number;
  rooms: number | null;
  address: string | null;
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  floor: number | null;
  buildingYear: number | null;
  buildingType: string | null;
  heating: string | null;
  finishCondition: string | null;
  photos: string[] | null;
}

// Map frontend city IDs to API slugs
const CITY_API_SLUGS: Record<string, string> = {
  warsaw: 'warszawa',
  krakow: 'krakow',
  wroclaw: 'wroclaw',
  katowice: 'katowice',
  gdansk: 'gdansk',
  poznan: 'poznan',
  lodz: 'lodz',
};

// Reverse map: API slug -> frontend city ID
const SLUG_TO_CITY: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_API_SLUGS).map(([k, v]) => [v, k])
);

// Get tier color for legend
function getTierColor(price: number): string {
  if (price < 12000) return '#22c55e';
  if (price < 14000) return '#84cc16';
  if (price < 16000) return '#eab308';
  if (price < 18000) return '#f97316';
  if (price < 22000) return '#ef4444';
  return '#dc2626';
}

// Dynamic import for Map to avoid SSR issues with MapLibre
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a1218] rounded-lg">
      <div className="text-gray-500 font-mono text-sm">INITIALIZING MAP...</div>
    </div>
  ),
});

export default function Home() {
  const [currentCity, setCurrentCity] = useState('warsaw');
  const [flyToCity, setFlyToCity] = useState<string | null>(null);
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const [focusedDistrict, setFocusedDistrict] = useState<string | null>(null);
  const [hoveredListing, setHoveredListing] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [selectedListing, setSelectedListing] = useState<SelectedListing | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding on first visit
  useEffect(() => {
    if (!localStorage.getItem('onboarding-dismissed')) {
      setShowOnboarding(true);
    }
  }, []);

  // Map display options
  const [offerType, setOfferType] = useState<'sale' | 'rent'>('sale');
  const [showListings, setShowListings] = useState(true);
  const [showDistrictLabels, setShowDistrictLabels] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showDistrictFill, setShowDistrictFill] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Listing filters
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);

  // Left panel collapse states
  const [priceIndexOpen, setPriceIndexOpen] = useState(true);
  const [districtAnalysisOpen, setDistrictAnalysisOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(true);

  // Ignore & Favourite listings
  const [ignoredListings, setIgnoredListings] = useState<Set<string>>(new Set());
  const [favouriteListings, setFavouriteListings] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const ignored = localStorage.getItem('ignored-listings');
      const favourites = localStorage.getItem('favourite-listings');
      if (ignored) setIgnoredListings(new Set(JSON.parse(ignored)));
      if (favourites) setFavouriteListings(new Set(JSON.parse(favourites)));
    } catch {}
  }, []);

  const toggleIgnore = (id: string) => {
    setIgnoredListings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('ignored-listings', JSON.stringify([...next]));
      return next;
    });
    // Remove from favourites if ignoring
    setFavouriteListings(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('favourite-listings', JSON.stringify([...next]));
      return next;
    });
  };

  const toggleFavourite = (id: string) => {
    setFavouriteListings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('favourite-listings', JSON.stringify([...next]));
      return next;
    });
    // Remove from ignored if favouriting
    setIgnoredListings(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      localStorage.setItem('ignored-listings', JSON.stringify([...next]));
      return next;
    });
  };

  // Debounce text filter inputs so API only fires 500ms after user stops typing
  const debouncedMinPrice = useDebounce(minPrice, 500);
  const debouncedMaxPrice = useDebounce(maxPrice, 500);
  const debouncedMinSize = useDebounce(minSize, 500);
  const debouncedMaxSize = useDebounce(maxSize, 500);

  const listingFilters = useMemo(() => ({
    minPrice: debouncedMinPrice ? parseInt(debouncedMinPrice, 10) : undefined,
    maxPrice: debouncedMaxPrice ? parseInt(debouncedMaxPrice, 10) : undefined,
    minSize: debouncedMinSize ? parseInt(debouncedMinSize, 10) : undefined,
    maxSize: debouncedMaxSize ? parseInt(debouncedMaxSize, 10) : undefined,
    rooms: selectedRooms.length > 0 ? selectedRooms : undefined,
  }), [debouncedMinPrice, debouncedMaxPrice, debouncedMinSize, debouncedMaxSize, selectedRooms]);

  // Viewport-based district data
  const { data: cityData, loading, error, updatedAt, visibleCities } = useViewportDistricts(bbox, offerType);
  const { playSound, setEnabled } = useSoundEffects();

  // Derive currentCity from visible cities
  useEffect(() => {
    if (visibleCities.length > 0) {
      // Prefer the first visible city, mapped back to frontend ID
      const frontendCity = SLUG_TO_CITY[visibleCities[0]] || visibleCities[0];
      if (frontendCity !== currentCity && CITIES[frontendCity]) {
        setCurrentCity(frontendCity);
      }
    }
  }, [visibleCities, currentCity]);

  const cityConfig = CITIES[currentCity] || CITIES['warsaw'];

  // Sync sound enabled state
  useEffect(() => {
    setEnabled(soundEnabled);
  }, [soundEnabled, setEnabled]);

  // Handle bounds change from map
  const handleBoundsChange = useCallback((newBbox: [number, number, number, number]) => {
    setBbox(newBbox);
  }, []);

  // Handle city change from selector (fly to city)
  const handleCityChange = useCallback((city: string) => {
    playSound('swoosh');
    setFlyToCity(city);
    setCurrentCity(city);
    setSearchLocation(null);
    setFocusedDistrict(null);
    // Reset flyToCity after a tick so the effect can re-trigger for the same city
    setTimeout(() => setFlyToCity(null), 100);
  }, [playSound]);

  // Calculate city-wide stats
  const cityStats = useMemo(() => {
    if (!cityData) {
      return { avgPrice: 0, totalListings: 0, avgChange: 0, highest: null, lowest: null, districtCount: 0, avgYield: 0 };
    }

    const stats = Object.values(cityData.DISTRICT_STATS);
    if (stats.length === 0) {
      return { avgPrice: 0, totalListings: 0, avgChange: 0, highest: null, lowest: null, districtCount: 0, avgYield: 0 };
    }

    // Use avgPrice for rent, avgPriceM2 for sale
    const getPrice = (s: typeof stats[0]) => offerType === 'rent' ? (s.avgPrice || 0) : s.avgPriceM2;
    const avgPrice = Math.round(stats.reduce((sum, s) => sum + getPrice(s), 0) / stats.length);
    const totalListings = stats.reduce((sum, s) => sum + s.listingCount, 0);
    const avgChange = stats.reduce((sum, s) => sum + s.change30d, 0) / stats.length;

    const sorted = [...stats].sort((a, b) => getPrice(b) - getPrice(a));
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    // Average rental yield
    const yieldsWithData = stats.filter(s => s.rentalYield != null && s.rentalYield > 0);
    const avgYield = yieldsWithData.length > 0
      ? yieldsWithData.reduce((sum, s) => sum + s.rentalYield!, 0) / yieldsWithData.length
      : 0;

    const mostActive = stats.reduce((best, s) => s.listingCount > best.listingCount ? s : best, stats[0]);

    return { avgPrice, totalListings, avgChange, highest, lowest, districtCount: stats.length, avgYield, mostActive };
  }, [cityData, offerType]);

  const [timeString, setTimeString] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client to avoid hydration mismatch
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleMobileDistrictSelect = (district: string | null) => {
    setFocusedDistrict(district);
    setMobileMenuOpen(false);
  };

  // Derive city slug for API calls (listings, trend chart)
  const citySlug = CITY_API_SLUGS[currentCity] || currentCity;

  const renderSidebarPanels = (onDistrictSelect: (d: string | null) => void) => (
    <>
      {/* Offer Type Toggle — always visible at top */}
      <div className="tactical-panel tactical-panel-bottom rounded-lg p-1 flex gap-1 flex-shrink-0">
        <button
          onClick={() => { playSound('click'); setOfferType('sale'); }}
          className={`flex-1 py-2 rounded font-mono text-xs font-semibold tracking-widest transition-colors ${
            offerType === 'sale'
              ? 'bg-[#00d4aa] text-black'
              : 'text-gray-400 hover:bg-[#00d4aa15]'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => { playSound('click'); setOfferType('rent'); }}
          className={`flex-1 py-2 rounded font-mono text-xs font-semibold tracking-widest transition-colors ${
            offerType === 'rent'
              ? 'bg-[#00d4aa] text-black'
              : 'text-gray-400 hover:bg-[#00d4aa15]'
          }`}
        >
          RENT
        </button>
      </div>

      {/* Legend Panel */}
      <div className="tactical-panel tactical-panel-bottom rounded-lg overflow-hidden flex-shrink-0">
        <button
          onClick={() => setPriceIndexOpen(!priceIndexOpen)}
          className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
            <h2 className="tactical-label">DISTRICTS PRICE INDEX</h2>
          </div>
          <span className="font-mono text-xs text-[#00d4aa]">{priceIndexOpen ? '−' : '+'}</span>
        </button>
        {priceIndexOpen && (
          <div className="px-4 pb-4">
            <Legend offerType={offerType} />
          </div>
        )}
      </div>

      {/* Layers Panel */}
      <div className="tactical-panel tactical-panel-bottom rounded-lg overflow-hidden flex-shrink-0">
        <button
          onClick={() => setLayersOpen(!layersOpen)}
          className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
            <h2 className="tactical-label">LAYERS</h2>
          </div>
          <span className="font-mono text-xs text-[#00d4aa]">{layersOpen ? '−' : '+'}</span>
        </button>
        {layersOpen && (
          <div className="px-4 pb-3 flex flex-col gap-3">
            {/* Layer Toggles */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showDistrictLabels} onChange={(e) => setShowDistrictLabels(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">DISTRICT LABELS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showListings} onChange={(e) => setShowListings(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">LISTINGS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showDistrictFill} onChange={(e) => setShowDistrictFill(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">PRICE OVERLAY</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">SOUND FX</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      <div className={`tactical-panel tactical-panel-bottom rounded-lg overflow-hidden min-h-fit ${(minPrice || maxPrice || minSize || maxSize || selectedRooms.length > 0) ? 'border-yellow-400/30' : ''}`}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${(minPrice || maxPrice || minSize || maxSize || selectedRooms.length > 0) ? 'bg-yellow-400 animate-pulse' : 'bg-[#00d4aa]'}`} />
            <h2 className="tactical-label">LISTING FILTERS</h2>
            {(minPrice || maxPrice || minSize || maxSize || selectedRooms.length > 0) && (
              <span className="font-mono text-[10px] text-yellow-400">ACTIVE</span>
            )}
          </div>
          <span className="font-mono text-xs text-[#00d4aa]">{filtersOpen ? '−' : '+'}</span>
        </button>
        {filtersOpen && (
          <div className="px-4 pb-4 space-y-4">
            {/* Price Range */}
            <div>
              <p className="font-mono text-[10px] text-gray-500 mb-2">PRICE (PLN)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-[#0a1218] border border-[#00d4aa20] rounded px-2 py-1.5 font-mono text-xs text-white placeholder-gray-600 focus:border-[#00d4aa] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-[#0a1218] border border-[#00d4aa20] rounded px-2 py-1.5 font-mono text-xs text-white placeholder-gray-600 focus:border-[#00d4aa] focus:outline-none"
                />
              </div>
            </div>

            {/* Size Range */}
            <div>
              <p className="font-mono text-[10px] text-gray-500 mb-2">SIZE (M²)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minSize}
                  onChange={(e) => setMinSize(e.target.value)}
                  className="w-full bg-[#0a1218] border border-[#00d4aa20] rounded px-2 py-1.5 font-mono text-xs text-white placeholder-gray-600 focus:border-[#00d4aa] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxSize}
                  onChange={(e) => setMaxSize(e.target.value)}
                  className="w-full bg-[#0a1218] border border-[#00d4aa20] rounded px-2 py-1.5 font-mono text-xs text-white placeholder-gray-600 focus:border-[#00d4aa] focus:outline-none"
                />
              </div>
            </div>

            {/* Rooms */}
            <div>
              <p className="font-mono text-[10px] text-gray-500 mb-2">ROOMS</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((room) => (
                  <button
                    key={room}
                    onClick={() => {
                      playSound('pop');
                      setSelectedRooms(prev =>
                        prev.includes(room)
                          ? prev.filter(r => r !== room)
                          : [...prev, room]
                      );
                    }}
                    className={`flex-1 py-1.5 font-mono text-xs rounded transition-colors ${
                      selectedRooms.includes(room)
                        ? 'bg-[#00d4aa] text-black'
                        : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
                    }`}
                  >
                    {room === 5 ? '5+' : room}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(minPrice || maxPrice || minSize || maxSize || selectedRooms.length > 0) && (
              <button
                onClick={() => {
                  playSound('swoosh');
                  setMinPrice('');
                  setMaxPrice('');
                  setMinSize('');
                  setMaxSize('');
                  setSelectedRooms([]);
                }}
                className="w-full py-1.5 font-mono text-[10px] text-gray-400 hover:text-white border border-[#00d4aa20] rounded hover:border-[#00d4aa40] transition-colors"
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Price Trend Panel — visible when a district is focused */}
      {focusedDistrict && (
        <div className="tactical-panel tactical-panel-bottom rounded-lg overflow-hidden flex-shrink-0">
          <button
            onClick={() => setTrendOpen(!trendOpen)}
            className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
              <h2 className="tactical-label">PRICE TREND</h2>
              <span className="font-mono text-[10px] text-[#00d4aa]">{focusedDistrict.toUpperCase().replace(/-/g, ' ')}</span>
            </div>
            <span className="font-mono text-xs text-[#00d4aa]">{trendOpen ? '−' : '+'}</span>
          </button>
          {trendOpen && (
            <div className="px-2 pb-3">
              <TrendChart city={citySlug} district={focusedDistrict} offerType={offerType} compact />
            </div>
          )}
        </div>
      )}

      {/* Stats Panel */}
      <div className="min-h-fit tactical-panel tactical-panel-bottom rounded-lg overflow-hidden">
        <button
          onClick={() => setDistrictAnalysisOpen(!districtAnalysisOpen)}
          className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
            <h2 className="tactical-label">PRICE RANKING</h2>
            {loading && <span className="font-mono text-[10px] text-gray-500 animate-pulse">LOADING...</span>}
          </div>
          <span className="font-mono text-xs text-[#00d4aa]">{districtAnalysisOpen ? '−' : '+'}</span>
        </button>
        {districtAnalysisOpen && (
          <div className="px-4 pb-4 h-[calc(100%-48px)] overflow-x-hidden overflow-y-scroll">
            {cityData ? (
              <StatsPanel
                cityData={cityData}
                selectedDistrict={focusedDistrict}
                onDistrictSelect={onDistrictSelect}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="font-mono text-xs text-gray-600">
                  {loading ? 'Loading...' : 'No data'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <main className="h-screen flex flex-col bg-[#05080a] grid-bg overflow-hidden">
      {/* Header - Command Bar */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-[#00d4aa15]">
        <div className="flex items-center justify-between">
          {/* Left - Title */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Hamburger - Mobile only */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex flex-col gap-1 p-1"
              aria-label="Open menu"
            >
              <span className="block w-5 h-0.5 bg-[#00d4aa]" />
              <span className="block w-5 h-0.5 bg-[#00d4aa]" />
              <span className="block w-5 h-0.5 bg-[#00d4aa]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00d4aa] rounded-full status-live" />
              <span className="tactical-label hidden sm:inline">LIVE DATA</span>
            </div>
            <div className="h-4 w-px bg-[#00d4aa20]" />
            <h1 className="font-mono text-lg font-semibold tracking-tight hidden xl:block">
              <span className="text-[#00d4aa]">PRICE</span>
              <span className="text-gray-500">{' // '}</span>
              <span className="text-white">MONITOR</span>
            </h1>
          </div>

          {/* Center - City Selector (fills available space) */}
          <div className="flex-1 min-w-0 mx-3">
            <CitySelector
                currentCity={currentCity}
                onCityChange={handleCityChange}
              />
          </div>

          {/* Right - Useful city stats */}
          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <p className="tactical-label">BEST VALUE</p>
                <p className="font-mono text-sm text-[#22c55e]">
                  {cityStats.lowest
                    ? `${cityStats.lowest.district.toUpperCase().replace(/-/g, ' ')} · ${(cityStats.lowest.avgPriceM2 / 1000).toFixed(1)}K`
                    : '—'}
                </p>
              </div>
              <div className="h-8 w-px bg-[#00d4aa20]" />
              <div className="text-right">
                <p className="tactical-label">MOST ACTIVE</p>
                <p className="font-mono text-sm text-[#00d4aa]">
                  {cityStats.mostActive
                    ? `${cityStats.mostActive.district.toUpperCase().replace(/-/g, ' ')} · ${cityStats.mostActive.listingCount}`
                    : '—'}
                </p>
              </div>
              <div className="h-8 w-px bg-[#00d4aa20]" />
            </div>
            <div className="text-right">
              <p className="tactical-label">TIME</p>
              <p className="font-mono text-sm text-white">{timeString ? timeString.slice(0, 5) : '--:--'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Sidebar - Desktop only */}
        <aside className="w-72 flex-shrink-0 overflow-y-scroll hidden md:flex flex-col gap-3 h-auto">
          {renderSidebarPanels(setFocusedDistrict)}
        </aside>

        {/* Map Area */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Map */}
          <div className="flex-1 relative tactical-panel tactical-panel-bottom rounded-lg overflow-hidden">
            <Map
              cityId={currentCity}
              cityData={cityData || { DISTRICT_STATS: {}, DISTRICT_CENTERS: [], DISTRICTS_GEOJSON: { type: 'FeatureCollection', features: [] } }}
              offerType={offerType}
              onBoundsChange={handleBoundsChange}
              searchLocation={searchLocation}
              focusedDistrict={focusedDistrict}
              onDistrictClick={setFocusedDistrict}
              showListings={showListings}
              showDistrictLabels={showDistrictLabels}
              showHeatmap={showHeatmap}
              showDistrictFill={showDistrictFill}
              listingFilters={listingFilters}
              hoveredListingId={hoveredListing?.id}
              ignoredListings={ignoredListings}
              favouriteListings={favouriteListings}
              flyToCity={flyToCity}
              onListingClick={setSelectedListing}
            />

            {/* Status overlay - top right */}
            <div className="absolute top-3 right-3 z-[10] flex flex-col gap-1.5 items-end">
              {loading && (
                <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full animate-pulse" />
                  <span className="font-mono text-xs text-[#00d4aa] animate-pulse">LOADING DISTRICTS...</span>
                </div>
              )}
              {!loading && visibleCities.length > 0 && (
                <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
                  <span className="font-mono text-[10px] text-gray-400">AREA</span>
                  <span className="font-mono text-xs text-white">
                    {visibleCities.map(slug => {
                      const fid = SLUG_TO_CITY[slug] || slug;
                      return (CITIES[fid]?.name || slug).toUpperCase();
                    }).join(' / ')}
                  </span>
                </div>
              )}
            </div>

            {/* Map Overlays */}
            {(() => {
              const activeFilterCount = [
                listingFilters.minPrice, listingFilters.maxPrice,
                listingFilters.minSize, listingFilters.maxSize,
              ].filter(Boolean).length + (listingFilters.rooms ? 1 : 0);
              return (
                <div className="absolute top-3 left-3 z-[10] flex items-center gap-2">
                  <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
                    <span className="font-mono text-[10px] text-gray-500">UPDATED</span>
                    <span className="font-mono text-xs text-[#00d4aa]">
                      {updatedAt
                        ? new Date(updatedAt).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : '—'}
                    </span>
                  </div>
                  {activeFilterCount > 0 && (
                    <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                      <span className="font-mono text-xs text-yellow-400">{activeFilterCount} FILTER{activeFilterCount > 1 ? 'S' : ''} ACTIVE</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Address Search */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-72 z-[45]">
              <AddressSearch
                cityName={cityConfig.name}
                onLocationFound={setSearchLocation}
                onClear={() => setSearchLocation(null)}
              />
            </div>


            <div className="absolute bottom-3 left-3 z-[10] flex flex-col gap-2">
              <div className="tactical-panel rounded px-3 py-1.5">
                <span className="font-mono text-xs text-gray-400">{cityStats.districtCount} DISTRICTS MONITORED</span>
              </div>
              {focusedDistrict && cityData?.DISTRICT_STATS[focusedDistrict] && (
                <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <span className="w-2.5 h-2.5 border-2 rotate-45 border-[#05080a]" style={{ background: '#3b82f6' }} />
                    <span className="w-2.5 h-2.5 border-2 rotate-45 border-[#05080a]" style={{ background: '#06b6d4' }} />
                    <span className="w-2.5 h-2.5 border-2 rotate-45 border-[#05080a]" style={{ background: '#a3a3a3' }} />
                    <span className="w-2.5 h-2.5 border-2 rotate-45 border-[#05080a]" style={{ background: '#f59e0b' }} />
                    <span className="w-2.5 h-2.5 border-2 rotate-45 border-[#05080a]" style={{ background: '#ef4444' }} />
                  </div>
                  <span className="font-mono text-[10px] text-gray-500">BELOW</span>
                  <span className="font-mono text-[10px] text-gray-600">→</span>
                  <span className="font-mono text-[10px] text-gray-500">ABOVE AVG</span>
                </div>
              )}
            </div>

          </div>

          {/* Bottom Stats Bar */}
          <div className="flex-shrink-0 tactical-panel tactical-panel-bottom rounded-lg p-3">
            {(() => {
              const ds: DistrictStats | undefined = focusedDistrict && cityData
                ? Object.values(cityData.DISTRICT_STATS).find(d => d.district === focusedDistrict)
                : undefined;

              if (ds) {
                const price = offerType === 'rent' ? (ds.avgPrice || 0) : ds.avgPriceM2;
                const changeColor = ds.change30d >= 0 ? 'text-red-400' : 'text-green-400';
                const rcnDiff = ds.rcnMedianPriceM2
                  ? ((ds.medianPriceM2 - ds.rcnMedianPriceM2) / ds.rcnMedianPriceM2 * 100)
                  : null;
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-3 sm:gap-5 overflow-x-auto min-w-0">
                      <div className="shrink-0">
                        <p className="tactical-label">DISTRICT</p>
                        <p className="font-mono text-sm sm:text-base text-white font-semibold">{ds.district.toUpperCase().replace(/-/g, ' ')}</p>
                      </div>
                      <div className="h-8 w-px bg-[#00d4aa20] shrink-0" />
                      <div className="shrink-0">
                        <p className="tactical-label">{offerType === 'sale' ? 'AVG/M²' : 'AVG RENT'}</p>
                        <p className="font-mono text-sm sm:text-base text-[#00d4aa] data-glow">
                          <CountUp value={price} separator=" " />
                        </p>
                      </div>
                      <div className="h-8 w-px bg-[#00d4aa20] shrink-0" />
                      <div className="shrink-0">
                        <p className="tactical-label">MEDIAN</p>
                        <p className="font-mono text-sm sm:text-base text-white">
                          <CountUp value={ds.medianPriceM2} separator=" " />
                        </p>
                      </div>
                      <div className="h-8 w-px bg-[#00d4aa20] shrink-0" />
                      <div className="shrink-0">
                        <p className="tactical-label">30D</p>
                        <p className={`font-mono text-sm sm:text-base ${changeColor}`}>
                          {ds.change30d >= 0 ? '+' : ''}<CountUp value={Math.abs(ds.change30d)} decimals={1} />%
                        </p>
                      </div>
                      <div className="h-8 w-px bg-[#00d4aa20] shrink-0" />
                      <div className="shrink-0">
                        <p className="tactical-label">LISTINGS</p>
                        <p className="font-mono text-sm sm:text-base text-white">
                          <CountUp value={ds.listingCount} separator=" " />
                        </p>
                      </div>
                      {ds.avgSize > 0 && (
                        <>
                          <div className="h-8 w-px bg-[#00d4aa20] shrink-0 hidden md:block" />
                          <div className="shrink-0 hidden md:block">
                            <p className="tactical-label">SIZE</p>
                            <p className="font-mono text-sm sm:text-base text-white">{ds.avgSize} m²</p>
                          </div>
                        </>
                      )}
                      {ds.rentalYield != null && ds.rentalYield > 0 && (
                        <>
                          <div className="h-8 w-px bg-[#00d4aa20] shrink-0 hidden md:block" />
                          <div className="shrink-0 hidden md:block">
                            <p className="tactical-label">YIELD</p>
                            <p className={`font-mono text-sm sm:text-base ${ds.rentalYield >= 5 ? 'text-green-400' : ds.rentalYield >= 4 ? 'text-yellow-400' : 'text-orange-400'}`}>
                              <CountUp value={ds.rentalYield} decimals={1} />%
                            </p>
                          </div>
                        </>
                      )}
                      {rcnDiff !== null && ds.rcnMedianPriceM2 && offerType === 'sale' && (
                        <>
                          <div className="h-8 w-px bg-[#00d4aa20] shrink-0 hidden xl:block" />
                          <div className="shrink-0 hidden xl:block">
                            <p className="tactical-label text-purple-400">TXN</p>
                            <p className="font-mono text-sm sm:text-base text-purple-400">
                              <CountUp value={ds.rcnMedianPriceM2} separator=" " />
                            </p>
                          </div>
                          <div className="shrink-0 hidden xl:block">
                            <p className="tactical-label">vs TXN</p>
                            <p className={`font-mono text-sm sm:text-base ${rcnDiff > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                              {rcnDiff > 0 ? '+' : ''}{rcnDiff.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setFocusedDistrict(null)}
                      className="text-gray-500 hover:text-white transition-colors p-1 shrink-0"
                      title="Clear selection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              }

              return (
                <div className="flex flex-wrap items-center justify-between gap-y-2">
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                    <div>
                      <p className="tactical-label">{offerType === 'sale' ? 'AVG PRICE / M²' : 'AVG RENT / MONTH'}</p>
                      <p className="font-mono text-base sm:text-lg text-[#00d4aa] data-glow">
                        <CountUp value={cityStats.avgPrice} separator=" " /> PLN
                      </p>
                    </div>
                    <div className="h-8 w-px bg-[#00d4aa20]" />
                    <div>
                      <p className="tactical-label">ACTIVE LISTINGS</p>
                      <p className="font-mono text-base sm:text-lg text-white">
                        <CountUp value={cityStats.totalListings} separator=" " />
                      </p>
                    </div>
                    <div className="h-8 w-px bg-[#00d4aa20]" />
                    <div>
                      <p className="tactical-label">30D CHANGE</p>
                      <p className={`font-mono text-base sm:text-lg ${cityStats.avgChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {cityStats.avgChange >= 0 ? '+' : ''}<CountUp value={Math.abs(cityStats.avgChange)} decimals={1} />%
                      </p>
                    </div>
                    {cityStats.avgYield > 0 && (
                      <>
                        <div className="h-8 w-px bg-[#00d4aa20] hidden sm:block" />
                        <div className="hidden sm:block">
                          <p className="tactical-label">AVG YIELD</p>
                          <p className={`font-mono text-base sm:text-lg ${cityStats.avgYield >= 5 ? 'text-green-400' : cityStats.avgYield >= 4 ? 'text-yellow-400' : 'text-orange-400'}`}>
                            <CountUp value={cityStats.avgYield} decimals={1} />%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="hidden lg:flex items-center gap-6">
                    <div>
                      <p className="tactical-label">HIGHEST</p>
                      <p className="font-mono text-sm">
                        {cityStats.highest ? (
                          <>
                            <span className="text-red-400">{(offerType === 'rent' ? (cityStats.highest.avgPrice || 0) : cityStats.highest.avgPriceM2).toLocaleString('pl-PL')}</span>
                            <span className="text-gray-500"> {cityStats.highest.district.toUpperCase()}</span>
                          </>
                        ) : <span className="text-gray-500">--</span>}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-[#00d4aa20]" />
                    <div>
                      <p className="tactical-label">LOWEST</p>
                      <p className="font-mono text-sm">
                        {cityStats.lowest ? (
                          <>
                            <span className="text-green-400">{(offerType === 'rent' ? (cityStats.lowest.avgPrice || 0) : cityStats.lowest.avgPriceM2).toLocaleString('pl-PL')}</span>
                            <span className="text-gray-500"> {cityStats.lowest.district.toUpperCase()}</span>
                          </>
                        ) : <span className="text-gray-500">--</span>}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right Sidebar - District Listings (desktop) */}
        <aside className={`hidden md:block shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${focusedDistrict && cityData ? 'w-80' : 'w-0'}`}>
          {focusedDistrict && cityData && (
            <div className="w-80 h-full tactical-panel rounded-lg overflow-hidden">
              <ListingsPanel
                city={citySlug}
                district={focusedDistrict}
                offerType={offerType}
                filters={listingFilters}
                onListingHover={(listing) => setHoveredListing(listing ? { id: listing.id, lat: listing.lat, lng: listing.lng } : null)}
                onClose={() => setFocusedDistrict(null)}
                ignoredListings={ignoredListings}
                favouriteListings={favouriteListings}
                onIgnore={toggleIgnore}
                onFavourite={toggleFavourite}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Listings Bottom Sheet */}
      {focusedDistrict && cityData && (
        <div className="md:hidden fixed inset-x-0 bottom-0 top-[35vh] z-60 flex flex-col bg-[#05080a] rounded-t-xl border-t border-[#00d4aa30] shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
          {/* Drag handle */}
          <div className="flex justify-center py-2 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <ListingsPanel
            city={citySlug}
            district={focusedDistrict}
            offerType={offerType}
            filters={listingFilters}
            onListingHover={(listing) => setHoveredListing(listing ? { id: listing.id, lat: listing.lat, lng: listing.lng } : null)}
            onClose={() => setFocusedDistrict(null)}
            ignoredListings={ignoredListings}
            favouriteListings={favouriteListings}
            onIgnore={toggleIgnore}
            onFavourite={toggleFavourite}
          />
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#05080a]/95 backdrop-blur-sm overflow-y-auto md:hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#00d4aa] rounded-full status-live" />
                <span className="tactical-label">SETTINGS</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <span className="font-mono text-lg">✕</span>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {renderSidebarPanels(handleMobileDistrictSelect)}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-1 border-t border-[#00d4aa15] hidden md:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : error ? 'bg-red-400' : 'bg-[#00d4aa]'}`} />
            <span className="font-mono text-[10px] text-gray-600">
              {updatedAt ? `UPDATED ${new Date(updatedAt).toLocaleDateString('pl-PL')}` : 'N/A'}
            </span>
            <span className="font-mono text-[10px] text-gray-700">·</span>
            <span className="font-mono text-[10px] text-gray-600">SOURCE: MORIZON</span>
          </div>
          <span className="font-mono text-[10px] text-gray-700">MAPA CEN MIESZKAŃ v1.0</span>
        </div>
      </footer>
      {/* Listing Detail Modal */}
      {selectedListing && (
        <ListingDetail
          listing={selectedListing}
          districtAvgPriceM2={
            focusedDistrict && cityData?.DISTRICT_STATS[focusedDistrict]
              ? cityData.DISTRICT_STATS[focusedDistrict].avgPriceM2
              : undefined
          }
          districtName={focusedDistrict || undefined}
          offerType={offerType}
          onClose={() => setSelectedListing(null)}
        />
      )}

      {/* Onboarding overlay — first visit only */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="tactical-panel tactical-panel-bottom rounded-lg p-6 max-w-sm mx-4 text-center">
            <div className="w-3 h-3 bg-[#00d4aa] rounded-full mx-auto mb-4 status-live" />
            <h2 className="font-mono text-lg text-white mb-2">PRICE MONITOR</h2>
            <p className="font-mono text-xs text-gray-400 mb-4 leading-relaxed">
              Districts are colored by price per m². Click a district to explore listings and price trends.
            </p>
            <div className="flex flex-col gap-2 text-left mb-5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#22c55e] shrink-0" />
                <span className="font-mono text-[10px] text-gray-400">Green districts = cheaper</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#ef4444] shrink-0" />
                <span className="font-mono text-[10px] text-gray-400">Red districts = more expensive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rotate-45 bg-[#3b82f6] shrink-0" />
                <span className="font-mono text-[10px] text-gray-400">Blue markers = listings below avg</span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem('onboarding-dismissed', '1');
              }}
              className="w-full py-2 rounded font-mono text-xs font-semibold tracking-widest bg-[#00d4aa] text-black hover:bg-[#00e4bb] transition-colors"
            >
              START EXPLORING
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
