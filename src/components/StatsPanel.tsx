'use client';

import { useState, useMemo } from 'react';
import { type CityData, type DistrictStats } from '@/lib/city-data';
import CountUp from './CountUp';
import { useSoundEffects } from '@/lib/useSoundEffects';

type SortKey = 'price' | 'change' | 'name' | 'listings';

interface StatsPanelProps {
  cityData: CityData;
  selectedDistrict: string | null;
  onDistrictSelect: (district: string | null) => void;
}

export default function StatsPanel({ cityData, selectedDistrict, onDistrictSelect }: StatsPanelProps) {
  const { playSound } = useSoundEffects();
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortAsc, setSortAsc] = useState(false);

  const handleDistrictClick = (districtName: string) => {
    playSound('click');
    const newSelected = selectedDistrict === districtName ? null : districtName;
    onDistrictSelect(newSelected);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      // Default direction: price desc, change desc, name asc, listings desc
      setSortAsc(key === 'name');
    }
  };

  const districts = useMemo(() => Object.values(cityData.DISTRICT_STATS)
    .filter(d => d.avgPriceM2 > 0), [cityData]);

  // Show TXN column only when at least one district has RCN data
  const hasRcnData = districts.some((d: DistrictStats) => d.rcnMedianPriceM2);

  const sortedDistricts = useMemo(() => {
    const sorted = [...districts];
    const dir = sortAsc ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'price': return (a.avgPriceM2 - b.avgPriceM2) * dir;
        case 'change': return (a.change30d - b.change30d) * dir;
        case 'listings': return (a.listingCount - b.listingCount) * dir;
        case 'name': return a.district.localeCompare(b.district) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [districts, sortKey, sortAsc]);

  const arrow = sortAsc ? '↑' : '↓';

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'price', label: 'PRICE' },
    { key: 'change', label: 'Δ30D' },
    { key: 'listings', label: 'LIST' },
    { key: 'name', label: 'A-Z' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sort controls — pill buttons */}
      <div className="pb-2 mb-2 border-b border-[#00d4aa10] flex items-center gap-1 flex-wrap">
        <span className="font-mono text-[10px] text-gray-600 mr-1">SORT</span>
        {sortOptions.map(opt => {
          const active = sortKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSort(opt.key)}
              className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
                active
                  ? 'bg-[#00d4aa] text-black'
                  : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
              }`}
            >
              {opt.label}{active ? ` ${arrow}` : ''}
            </button>
          );
        })}
      </div>

      {/* District list — 2-row layout: full name on top, stats below */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#00d4aa10] pr-1 min-h-[150px]">
        {sortedDistricts.map((district, index) => {
          const isHot = district.change30d > 2;
          const isCold = district.change30d < 0;
          const changeColor = district.change30d >= 0 ? 'text-red-400' : 'text-green-400';
          const changeIcon = district.change30d >= 0 ? '▲' : '▼';
          const isSelected = selectedDistrict === district.district;

          return (
            <div
              key={district.district}
              onClick={() => handleDistrictClick(district.district)}
              className={`py-2 px-2 rounded hover:bg-[#00d4aa08] transition-colors cursor-pointer group flex items-center gap-2 ${
                isSelected ? 'bg-[#00d4aa12] border-l-2 border-[#00d4aa]' : 'border-l-2 border-transparent'
              }`}
            >
              {/* Main content — two rows stacked */}
              <div className="flex-1 min-w-0">
                {/* Row 1 — index + full district name */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-gray-600 shrink-0 w-6">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs text-gray-200 group-hover:text-[#00d4aa] transition-colors font-semibold flex-1 min-w-0 truncate">
                    {district.district.toUpperCase().replace(/-/g, ' ')}
                  </span>
                </div>

                {/* Row 2 — stats, indented under name */}
                <div className="flex items-center gap-2 pl-8 mt-1 font-mono text-[11px]">
                  <span className="text-white font-semibold">
                    {(district.avgPriceM2 / 1000).toFixed(1)}K
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className={changeColor}>
                    {changeIcon} {Math.abs(district.change30d).toFixed(1)}%
                  </span>
                  {hasRcnData && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="text-purple-400">
                        {district.rcnMedianPriceM2 ? `TXN ${(district.rcnMedianPriceM2 / 1000).toFixed(1)}K` : 'TXN —'}
                      </span>
                    </>
                  )}
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-500">{district.listingCount}</span>
                </div>
              </div>

              {/* Badge — centered vertically against the two-row content */}
              {(isHot || isCold) && (
                <div className="shrink-0 flex items-center">
                  {isHot && (
                    <span className="font-mono text-[8px] text-red-500 bg-red-500/10 px-1 py-0.5 rounded">HOT</span>
                  )}
                  {isCold && (
                    <span className="font-mono text-[8px] text-green-500 bg-green-500/10 px-1 py-0.5 rounded">DIP</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-[#00d4aa10]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-gray-600">
            <CountUp value={sortedDistricts.length} duration={500} /> DISTRICTS
          </span>
          <span className="font-mono text-[10px] text-gray-600">
            <CountUp value={sortedDistricts.reduce((sum, d) => sum + d.listingCount, 0)} separator=" " /> LISTINGS
          </span>
        </div>
      </div>
    </div>
  );
}
