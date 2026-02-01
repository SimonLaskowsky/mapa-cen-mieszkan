'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Legend from '@/components/Legend';
import StatsPanel from '@/components/StatsPanel';
import CitySelector from '@/components/CitySelector';
import AddressSearch from '@/components/AddressSearch';
import { CITIES } from '@/lib/cities';
import { useDistrictData } from '@/lib/useDistrictData';

interface SearchLocation {
  lat: number;
  lng: number;
  displayName: string;
}

// Map frontend city IDs to API slugs
const CITY_API_SLUGS: Record<string, string> = {
  warsaw: 'warszawa',
  krakow: 'krakow',
  wroclaw: 'wroclaw',
  katowice: 'katowice',
};

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
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const [focusedDistrict, setFocusedDistrict] = useState<string | null>(null);

  // Map display options
  const [showListings, setShowListings] = useState(true);
  const [showDistrictLabels, setShowDistrictLabels] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Left panel collapse states
  const [priceIndexOpen, setPriceIndexOpen] = useState(true);
  const [districtAnalysisOpen, setDistrictAnalysisOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);

  const cityConfig = CITIES[currentCity];
  const { data: cityData, loading, error, updatedAt } = useDistrictData(currentCity);

  // Calculate city-wide stats
  const cityStats = useMemo(() => {
    if (!cityData) {
      return { avgPrice: 0, totalListings: 0, avgChange: 0, highest: null, lowest: null, districtCount: 0 };
    }

    const stats = Object.values(cityData.DISTRICT_STATS);
    if (stats.length === 0) {
      return { avgPrice: 0, totalListings: 0, avgChange: 0, highest: null, lowest: null, districtCount: 0 };
    }

    const avgPrice = Math.round(stats.reduce((sum, s) => sum + s.avgPriceM2, 0) / stats.length);
    const totalListings = stats.reduce((sum, s) => sum + s.listingCount, 0);
    const avgChange = stats.reduce((sum, s) => sum + s.change30d, 0) / stats.length;

    const sorted = [...stats].sort((a, b) => b.avgPriceM2 - a.avgPriceM2);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    return { avgPrice, totalListings, avgChange, highest, lowest, districtCount: stats.length };
  }, [cityData]);

  const [timeString, setTimeString] = useState<string | null>(null);
  const [dateString, setDateString] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client to avoid hydration mismatch
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateString(now.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="h-screen flex flex-col bg-[#05080a] grid-bg overflow-hidden">
      {/* Header - Command Bar */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-[#00d4aa15]">
        <div className="flex items-center justify-between">
          {/* Left - Title & City Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00d4aa] rounded-full status-live" />
              <span className="tactical-label">SYSTEM ACTIVE</span>
            </div>
            <div className="h-4 w-px bg-[#00d4aa20]" />
            <h1 className="font-mono text-lg font-semibold tracking-tight hidden lg:block">
              <span className="text-[#00d4aa]">REAL ESTATE</span>
              <span className="text-gray-500">{' // '}</span>
              <span className="text-white">PRICE MONITOR</span>
            </h1>
            <div className="h-4 w-px bg-[#00d4aa20] hidden lg:block" />
            <CitySelector
                currentCity={currentCity}
                onCityChange={(city) => {
                  setCurrentCity(city);
                  setSearchLocation(null);
                  setFocusedDistrict(null);
                }}
              />
          </div>

          {/* Center - Location */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <p className="tactical-label">REGION</p>
              <p className="font-mono text-sm text-white">{cityConfig.name.toUpperCase()}</p>
            </div>
            <div className="h-8 w-px bg-[#00d4aa20]" />
            <div className="text-center">
              <p className="tactical-label">COORDINATES</p>
              <p className="font-mono text-sm text-[#00d4aa]">
                {cityConfig.center[1].toFixed(4)}°N {cityConfig.center[0].toFixed(4)}°E
              </p>
            </div>
          </div>

          {/* Right - Time */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="tactical-label">LOCAL TIME</p>
              <p className="font-mono text-sm text-white">{timeString ?? '--:--:--'}</p>
            </div>
            <div className="h-8 w-px bg-[#00d4aa20]" />
            <div className="text-right">
              <p className="tactical-label">DATE</p>
              <p className="font-mono text-sm text-[#00d4aa]">{dateString ?? '--.--.----'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Sidebar */}
        <aside className="w-72 flex-shrink-0 overflow-y-auto flex flex-col gap-3 h-auto">
          {/* Legend Panel */}
          <div className="tactical-panel tactical-panel-bottom rounded-lg overflow-hidden flex-shrink-0">
            <button
              onClick={() => setPriceIndexOpen(!priceIndexOpen)}
              className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
                <h2 className="tactical-label">PRICE INDEX</h2>
              </div>
              <span className="font-mono text-xs text-[#00d4aa]">{priceIndexOpen ? '−' : '+'}</span>
            </button>
            {priceIndexOpen && (
              <div className="px-4 pb-4">
                <Legend />
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
              <div className="px-4 pb-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={showDistrictLabels} onChange={(e) => setShowDistrictLabels(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                  <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">DISTRICT LABELS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={showListings} onChange={(e) => setShowListings(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                  <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">LISTINGS</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} className="accent-[#00d4aa] w-3 h-3" />
                  <span className="font-mono text-[10px] text-gray-400 group-hover:text-white">PRICE HEATMAP</span>
                </label>
              </div>
            )}
          </div>

          {/* Stats Panel */}
          <div className="min-h-0 tactical-panel tactical-panel-bottom rounded-lg overflow-hidden">
            <button
              onClick={() => setDistrictAnalysisOpen(!districtAnalysisOpen)}
              className="w-full p-3 flex items-center justify-between hover:bg-[#00d4aa08] transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
                <h2 className="tactical-label">DISTRICT ANALYSIS</h2>
                {loading && <span className="font-mono text-[10px] text-gray-500 animate-pulse">LOADING...</span>}
              </div>
              <span className="font-mono text-xs text-[#00d4aa]">{districtAnalysisOpen ? '−' : '+'}</span>
            </button>
            {districtAnalysisOpen && (
              <div className="px-4 pb-4 h-[calc(100%-48px)] overflow-x-hidden overflow-y-scroll">
                {cityData ? (
                  <StatsPanel
                    cityData={cityData}
                    citySlug={CITY_API_SLUGS[currentCity] || currentCity}
                    selectedDistrict={focusedDistrict}
                    onDistrictSelect={setFocusedDistrict}
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
        </aside>

        {/* Map Area */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Map */}
          <div className="flex-1 relative tactical-panel tactical-panel-bottom rounded-lg overflow-hidden">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center bg-[#0a1218]">
                <div className="text-center">
                  <div className="text-[#00d4aa] font-mono text-sm animate-pulse">LOADING DATA...</div>
                  <div className="text-gray-600 font-mono text-xs mt-2">Fetching district statistics</div>
                </div>
              </div>
            ) : error ? (
              <div className="w-full h-full flex items-center justify-center bg-[#0a1218]">
                <div className="text-center">
                  <div className="text-red-400 font-mono text-sm">DATA UNAVAILABLE</div>
                  <div className="text-gray-600 font-mono text-xs mt-2">{error}</div>
                </div>
              </div>
            ) : cityData ? (
              <Map
                cityId={currentCity}
                cityData={cityData}
                onCityChange={(city) => {
                  setCurrentCity(city);
                  setSearchLocation(null);
                  setFocusedDistrict(null);
                }}
                searchLocation={searchLocation}
                focusedDistrict={focusedDistrict}
                onDistrictClick={setFocusedDistrict}
                showListings={showListings}
                showDistrictLabels={showDistrictLabels}
                showHeatmap={showHeatmap}
              />
            ) : null}

            {/* Map Overlays */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-xs text-red-400">LIVE FEED</span>
              </div>
            </div>

            {/* Address Search */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-72 z-[157]">
              <AddressSearch
                cityName={cityConfig.name}
                onLocationFound={setSearchLocation}
                onClear={() => setSearchLocation(null)}
              />
            </div>

            
            <div className="absolute bottom-3 left-3 flex flex-col gap-2">
              <div className="tactical-panel rounded px-3 py-1.5">
                <span className="font-mono text-xs text-gray-400">{cityStats.districtCount} DISTRICTS MONITORED</span>
              </div>
              {focusedDistrict && cityData?.DISTRICT_STATS[focusedDistrict] && (
                <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm opacity-90" style={{ backgroundColor: getTierColor(cityData.DISTRICT_STATS[focusedDistrict].avgPriceM2) }} />
                  <span className="font-mono text-[10px] text-gray-400">ABOVE AVG PRICE ZONE</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Stats Bar */}
          <div className="flex-shrink-0 tactical-panel tactical-panel-bottom rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="tactical-label">AVG PRICE / M²</p>
                  <p className="font-mono text-lg text-[#00d4aa] data-glow">
                    {cityStats.avgPrice.toLocaleString('pl-PL')} PLN
                  </p>
                </div>
                <div className="h-8 w-px bg-[#00d4aa20]" />
                <div>
                  <p className="tactical-label">ACTIVE LISTINGS</p>
                  <p className="font-mono text-lg text-white">
                    {cityStats.totalListings.toLocaleString('pl-PL')}
                  </p>
                </div>
                <div className="h-8 w-px bg-[#00d4aa20]" />
                <div>
                  <p className="tactical-label">30D CHANGE</p>
                  <p className={`font-mono text-lg ${cityStats.avgChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {cityStats.avgChange >= 0 ? '+' : ''}{cityStats.avgChange.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <p className="tactical-label">HIGHEST</p>
                  <p className="font-mono text-sm">
                    {cityStats.highest ? (
                      <>
                        <span className="text-red-400">{cityStats.highest.avgPriceM2.toLocaleString('pl-PL')}</span>
                        <span className="text-gray-500"> {cityStats.highest.district.toUpperCase()}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">--</span>
                    )}
                  </p>
                </div>
                <div className="h-8 w-px bg-[#00d4aa20]" />
                <div>
                  <p className="tactical-label">LOWEST</p>
                  <p className="font-mono text-sm">
                    {cityStats.lowest ? (
                      <>
                        <span className="text-green-400">{cityStats.lowest.avgPriceM2.toLocaleString('pl-PL')}</span>
                        <span className="text-gray-500"> {cityStats.lowest.district.toUpperCase()}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">--</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 border-t border-[#00d4aa15]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="tactical-label">SYSTEM STATUS:</span>
            <span className="font-mono text-[#00d4aa]">{loading ? 'SYNCING' : error ? 'ERROR' : 'OPERATIONAL'}</span>
            <span className="text-gray-600">|</span>
            <span className="tactical-label">LAST SYNC:</span>
            <span className="font-mono text-gray-400">
              {updatedAt ? new Date(updatedAt).toLocaleDateString('pl-PL') : 'N/A'}
            </span>
            <span className="text-gray-600">|</span>
            <span className="tactical-label">SOURCE:</span>
            <span className="font-mono text-[#00d4aa]">MORIZON</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="tactical-label text-gray-600">MAPA CEN MIESZKAŃ v1.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
