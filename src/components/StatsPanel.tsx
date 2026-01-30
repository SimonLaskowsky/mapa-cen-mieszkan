'use client';

import { CITY_DATA, formatPercent } from '@/lib/city-data';

interface StatsPanelProps {
  cityId: string;
}

export default function StatsPanel({ cityId }: StatsPanelProps) {
  const cityData = CITY_DATA[cityId];

  // Sort districts by price
  const sortedDistricts = Object.values(cityData.DISTRICT_STATS).sort(
    (a, b) => b.avgPriceM2 - a.avgPriceM2
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[#00d4aa10]">
        <span className="font-mono text-[10px] text-gray-600 w-6">#</span>
        <span className="font-mono text-[10px] text-gray-600 flex-1">DISTRICT</span>
        <span className="font-mono text-[10px] text-gray-600 w-16 text-right">PRICE</span>
        <span className="font-mono text-[10px] text-gray-600 w-12 text-right">Δ30D</span>
      </div>

      {/* District list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {sortedDistricts.map((district, index) => {
          const isHot = district.change30d > 2;
          const isCold = district.change30d < 0;
          const changeColor = district.change30d >= 0 ? 'text-red-400' : 'text-green-400';

          return (
            <div
              key={district.district}
              className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-[#00d4aa08] transition-colors cursor-pointer group"
            >
              <span className="font-mono text-[10px] text-gray-600 w-6">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-mono text-xs text-gray-300 truncate group-hover:text-[#00d4aa] transition-colors">
                  {district.district.toUpperCase()}
                </span>
                {isHot && (
                  <span className="font-mono text-[8px] text-red-500 bg-red-500/10 px-1 rounded">HOT</span>
                )}
                {isCold && (
                  <span className="font-mono text-[8px] text-green-500 bg-green-500/10 px-1 rounded">DIP</span>
                )}
              </div>
              <span className="font-mono text-xs text-white w-16 text-right">
                {(district.avgPriceM2 / 1000).toFixed(1)}K
              </span>
              <span className={`font-mono text-xs w-12 text-right ${changeColor}`}>
                {formatPercent(district.change30d)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-[#00d4aa10]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-gray-600">
            {sortedDistricts.length} TARGETS
          </span>
          <span className="font-mono text-[10px] text-gray-600">
            {sortedDistricts.reduce((sum, d) => sum + d.listingCount, 0).toLocaleString()} LISTINGS
          </span>
        </div>
      </div>
    </div>
  );
}
