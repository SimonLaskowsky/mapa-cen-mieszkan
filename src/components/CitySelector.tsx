'use client';

import { CITIES, CITY_ORDER } from '@/lib/cities';

interface CitySelectorProps {
  currentCity: string;
  onCityChange: (cityId: string) => void;
}

export default function CitySelector({ currentCity, onCityChange }: CitySelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {CITY_ORDER.map((cityId) => {
        const city = CITIES[cityId];
        const isActive = cityId === currentCity;

        return (
          <button
            key={cityId}
            onClick={() => onCityChange(cityId)}
            className={`
              relative px-3 py-1.5 font-mono text-xs uppercase tracking-wider
              transition-all duration-200 rounded
              ${isActive
                ? 'bg-[#00d4aa20] text-[#00d4aa] border border-[#00d4aa40]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
              }
            `}
          >
            {/* Active indicator dot */}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#00d4aa] rounded-full status-live" />
            )}

            <span className="hidden sm:inline">{city.name}</span>
            <span className="sm:hidden">{city.nameShort}</span>
          </button>
        );
      })}
    </div>
  );
}
