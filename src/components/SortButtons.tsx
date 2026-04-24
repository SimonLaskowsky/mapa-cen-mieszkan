'use client';

export type SortBy =
  | 'price_m2_asc'
  | 'price_m2_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | null;

interface SortButtonsProps {
  sortBy: SortBy;
  onChange: (s: SortBy) => void;
  showLabel?: boolean;
}

export default function SortButtons({ sortBy, onChange, showLabel = true }: SortButtonsProps) {
  const cyclePrice = (field: 'price_m2' | 'price') => {
    const asc = `${field}_asc` as SortBy;
    const desc = `${field}_desc` as SortBy;
    if (sortBy === asc) onChange(desc);
    else if (sortBy === desc) onChange(null);
    else onChange(asc);
  };

  const toggleNew = () => onChange(sortBy === 'newest' ? null : 'newest');

  const arrow = (field: 'price_m2' | 'price') => {
    if (sortBy === `${field}_asc`) return ' ↑';
    if (sortBy === `${field}_desc`) return ' ↓';
    return '';
  };

  const priceActive = (field: 'price_m2' | 'price') =>
    sortBy === `${field}_asc` || sortBy === `${field}_desc`;

  const base = 'px-2 py-1 rounded font-mono text-[10px] transition-colors';
  const activeCls = 'bg-[#00d4aa] text-black';
  const idleCls = 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]';

  return (
    <>
      {showLabel && <span className="font-mono text-[10px] text-gray-600 mr-1">SORT</span>}
      <button
        onClick={() => cyclePrice('price_m2')}
        title={
          sortBy === 'price_m2_asc' ? 'Cheapest per m² first — click for most expensive'
          : sortBy === 'price_m2_desc' ? 'Most expensive per m² first — click to clear'
          : 'Sort by price per m²'
        }
        className={`${base} ${priceActive('price_m2') ? activeCls : idleCls}`}
      >
        ZŁ/M²{arrow('price_m2')}
      </button>
      <button
        onClick={() => cyclePrice('price')}
        title={
          sortBy === 'price_asc' ? 'Cheapest first — click for most expensive'
          : sortBy === 'price_desc' ? 'Most expensive first — click to clear'
          : 'Sort by price'
        }
        className={`${base} ${priceActive('price') ? activeCls : idleCls}`}
      >
        PRICE{arrow('price')}
      </button>
      <button
        onClick={toggleNew}
        title={sortBy === 'newest' ? 'Newest first — click to clear' : 'Sort by newest'}
        className={`${base} ${sortBy === 'newest' ? activeCls : idleCls}`}
      >
        NEW
      </button>
    </>
  );
}
