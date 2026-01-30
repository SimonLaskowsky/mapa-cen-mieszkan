'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Legend from '@/components/Legend';
import StatsPanel from '@/components/StatsPanel';
import CitySelector from '@/components/CitySelector';
import { CITIES } from '@/lib/cities';
import { CITY_DATA } from '@/lib/city-data';

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

  const cityConfig = CITIES[currentCity];
  const cityData = CITY_DATA[currentCity];

  // Calculate city-wide stats
  const cityStats = useMemo(() => {
    const stats = Object.values(cityData.DISTRICT_STATS);
    const avgPrice = Math.round(stats.reduce((sum, s) => sum + s.avgPriceM2, 0) / stats.length);
    const totalListings = stats.reduce((sum, s) => sum + s.listingCount, 0);
    const avgChange = stats.reduce((sum, s) => sum + s.change30d, 0) / stats.length;

    const sorted = [...stats].sort((a, b) => b.avgPriceM2 - a.avgPriceM2);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    return { avgPrice, totalListings, avgChange, highest, lowest, districtCount: stats.length };
  }, [cityData]);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  const timeString = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = now.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
              <span className="text-gray-500"> // </span>
              <span className="text-white">PRICE MONITOR</span>
            </h1>
            <div className="h-4 w-px bg-[#00d4aa20] hidden lg:block" />
            <CitySelector currentCity={currentCity} onCityChange={setCurrentCity} />
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
              <p className="font-mono text-sm text-white">{timeString}</p>
            </div>
            <div className="h-8 w-px bg-[#00d4aa20]" />
            <div className="text-right">
              <p className="tactical-label">DATE</p>
              <p className="font-mono text-sm text-[#00d4aa]">{dateString}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left Sidebar */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* Legend Panel */}
          <div className="tactical-panel tactical-panel-bottom rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
              <h2 className="tactical-label">PRICE INDEX</h2>
            </div>
            <Legend />
          </div>

          {/* Stats Panel */}
          <div className="flex-1 overflow-hidden tactical-panel tactical-panel-bottom rounded-lg">
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
                <h2 className="tactical-label">DISTRICT ANALYSIS</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <StatsPanel cityId={currentCity} />
              </div>
            </div>
          </div>
        </aside>

        {/* Map Area */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Map */}
          <div className="flex-1 relative tactical-panel tactical-panel-bottom rounded-lg overflow-hidden">
            <Map cityId={currentCity} onCityChange={setCurrentCity} />

            {/* Map Overlays */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="tactical-panel rounded px-3 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-xs text-red-400">LIVE FEED</span>
              </div>
            </div>

            <div className="absolute top-3 right-12 tactical-panel rounded px-3 py-1.5">
              <span className="font-mono text-xs text-gray-400">ZOOM: </span>
              <span className="font-mono text-xs text-[#00d4aa]">{cityConfig.zoom.toFixed(1)}x</span>
            </div>

            <div className="absolute bottom-3 left-3 tactical-panel rounded px-3 py-1.5">
              <span className="font-mono text-xs text-gray-400">{cityStats.districtCount} DISTRICTS MONITORED</span>
            </div>

            <div className="absolute bottom-3 right-3 tactical-panel rounded px-3 py-1.5">
              <span className="font-mono text-xs text-gray-400">DATA SOURCE: </span>
              <span className="font-mono text-xs text-[#00d4aa]">OTODOM / OLX</span>
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
                    <span className="text-red-400">{cityStats.highest.avgPriceM2.toLocaleString('pl-PL')}</span>
                    <span className="text-gray-500"> {cityStats.highest.district.toUpperCase()}</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-[#00d4aa20]" />
                <div>
                  <p className="tactical-label">LOWEST</p>
                  <p className="font-mono text-sm">
                    <span className="text-green-400">{cityStats.lowest.avgPriceM2.toLocaleString('pl-PL')}</span>
                    <span className="text-gray-500"> {cityStats.lowest.district.toUpperCase()}</span>
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
            <span className="font-mono text-[#00d4aa]">OPERATIONAL</span>
            <span className="text-gray-600">|</span>
            <span className="tactical-label">LAST SYNC:</span>
            <span className="font-mono text-gray-400">2 HOURS AGO</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="tactical-label text-gray-600">MAPA CEN MIESZKAŃ v1.0</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
