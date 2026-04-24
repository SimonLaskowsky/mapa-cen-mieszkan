'use client';

import { useEffect, useState, useMemo } from 'react';
import { morizonPhotoAtSize } from '@/lib/photoUrl';
import SortButtons, { type SortBy } from './SortButtons';

interface Listing {
  id: string;
  externalId: string;
  city: string;
  district: string;
  address: string | null;
  lat: number;
  lng: number;
  price: number;
  sizeM2: number;
  pricePerM2: number;
  rooms: number | null;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  scrapedAt: string;
  photos: string[] | null;
  description: string | null;
}

type ListingFilter = 'all' | 'favs' | 'hide-ignored';

interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  rooms?: number[];
}

const formatPrice = (price: number) => new Intl.NumberFormat('pl-PL').format(price);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
};

const ratioColor = (ratio: number | null) => {
  if (ratio == null) return '#6b7280';
  if (ratio <= 0.7) return '#22c55e';
  if (ratio <= 0.85) return '#84cc16';
  if (ratio <= 1.0) return '#eab308';
  if (ratio <= 1.15) return '#f97316';
  return '#ef4444';
};

interface ListingsFullscreenProps {
  city: string;
  district: string;
  offerType: 'sale' | 'rent';
  filters?: ListingFilters;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  districtAvgPriceM2?: number;
  onListingHover?: (listing: Listing | null) => void;
  onClose: () => void;
  ignoredListings?: Set<string>;
  favouriteListings?: Set<string>;
  onIgnore?: (id: string) => void;
  onFavourite?: (id: string) => void;
}

export default function ListingsFullscreen({
  city,
  district,
  offerType,
  filters,
  sortBy,
  onSortChange,
  districtAvgPriceM2,
  onListingHover,
  onClose,
  ignoredListings,
  favouriteListings,
  onIgnore,
  onFavourite,
}: ListingsFullscreenProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListingFilter>('all');
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reset limit when inputs change
  useEffect(() => {
    setLimit(20);
  }, [city, district, offerType, filters, sortBy]);

  useEffect(() => {
    const fetchListings = async () => {
      if (limit === 20) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams({ city, district, offerType, limit: String(limit) });
        if (sortBy) params.set('sortBy', sortBy);
        if (filters?.minPrice) params.set('minPrice', String(filters.minPrice));
        if (filters?.maxPrice) params.set('maxPrice', String(filters.maxPrice));
        if (filters?.minSize) params.set('minSize', String(filters.minSize));
        if (filters?.maxSize) params.set('maxSize', String(filters.maxSize));
        if (filters?.rooms?.length) params.set('rooms', filters.rooms.join(','));
        const response = await fetch(`/api/listings?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setListings(data.listings || []);
        setTotal(data.total ?? data.count ?? 0);
      } catch (err) {
        setError('Failed to load listings');
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchListings();
  }, [city, district, offerType, filters, sortBy, limit]);

  const sortedAndFiltered = useMemo(() => {
    let filtered = listings;
    if (filter === 'favs') {
      filtered = listings.filter(l => favouriteListings?.has(l.id));
    } else if (filter === 'hide-ignored') {
      filtered = listings.filter(l => !ignoredListings?.has(l.id));
    }
    return [...filtered].sort((a, b) => {
      const aFav = favouriteListings?.has(a.id) ? 0 : 1;
      const bFav = favouriteListings?.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      const aIgn = ignoredListings?.has(a.id) ? 1 : 0;
      const bIgn = ignoredListings?.has(b.id) ? 1 : 0;
      return aIgn - bIgn;
    });
  }, [listings, filter, favouriteListings, ignoredListings]);

  const favCount = listings.filter(l => favouriteListings?.has(l.id)).length;
  const ignoredCount = listings.filter(l => ignoredListings?.has(l.id)).length;

  const priceRatio = (l: Listing) =>
    districtAvgPriceM2 && districtAvgPriceM2 > 0 ? l.pricePerM2 / districtAvgPriceM2 : null;

  return (
    <div className="absolute inset-0 z-[55] bg-[#05080a] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#00d4aa20] bg-[#05080a]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs text-[#00d4aa] border border-[#00d4aa40] hover:bg-[#00d4aa15] transition-colors"
              title="Back to map (Esc)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              BACK TO MAP
            </button>
            <div className="h-4 w-px bg-[#00d4aa20]" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
              <span className="font-mono text-xs text-[#00d4aa] truncate">
                {district.toUpperCase().replace(/-/g, ' ')}
              </span>
              {districtAvgPriceM2 ? (
                <>
                  <span className="text-gray-700">|</span>
                  <span className="font-mono text-[10px] text-gray-500">
                    AVG {formatPrice(Math.round(districtAvgPriceM2))} zł/m²
                  </span>
                </>
              ) : null}
              <span className="text-gray-700">|</span>
              <span className="font-mono text-[10px] text-gray-500">
                {total} {offerType === 'sale' ? 'FOR SALE' : 'FOR RENT'}
              </span>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <SortButtons sortBy={sortBy} onChange={onSortChange} />
          </div>
        </div>

        {/* Filter bar */}
        {listings.length > 0 && (
          <div className="px-4 py-2 border-t border-[#00d4aa10] flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
                filter === 'all' ? 'bg-[#00d4aa] text-black' : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilter('favs')}
              className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
                filter === 'favs' ? 'bg-[#eab308] text-black' : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
              }`}
            >
              ★ FAVS{favCount > 0 ? ` (${favCount})` : ''}
            </button>
            <button
              onClick={() => setFilter('hide-ignored')}
              className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
                filter === 'hide-ignored' ? 'bg-[#00d4aa] text-black' : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
              }`}
            >
              HIDE IGNORED{ignoredCount > 0 ? ` (${ignoredCount})` : ''}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[#00d4aa] font-mono text-sm animate-pulse">FETCHING LISTINGS...</div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-red-400 font-mono text-sm">{error}</div>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-gray-500 font-mono text-sm">
              {listings.length === 0 ? 'NO LISTINGS WITH COORDINATES' : filter === 'favs' ? 'NO FAVOURITES YET' : 'ALL LISTINGS IGNORED'}
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            {sortedAndFiltered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isIgnored={ignoredListings?.has(listing.id)}
                isFavourite={favouriteListings?.has(listing.id)}
                priceRatio={priceRatio(listing)}
                onListingHover={onListingHover}
                onFavourite={onFavourite}
                onIgnore={onIgnore}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {listings.length > 0 && listings.length < total && (
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => setLimit(prev => prev + 20)}
              disabled={loadingMore}
              className="w-full py-2 font-mono text-xs text-[#00d4aa] hover:text-white border border-[#00d4aa20] rounded hover:border-[#00d4aa40] transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'LOADING...' : `LOAD MORE (${listings.length} OF ${total})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ListingCardProps {
  listing: Listing;
  isIgnored?: boolean;
  isFavourite?: boolean;
  priceRatio: number | null;
  onListingHover?: (listing: Listing | null) => void;
  onFavourite?: (id: string) => void;
  onIgnore?: (id: string) => void;
}

function ListingCard({ listing, isIgnored, isFavourite, priceRatio, onListingHover, onFavourite, onIgnore }: ListingCardProps) {
  const rawPhotos = listing.photos?.length ? listing.photos : (listing.thumbnailUrl ? [listing.thumbnailUrl] : []);
  const photos = rawPhotos.map((u) => morizonPhotoAtSize(u, 'l'));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set());
  const hasMultiple = photos.length > 1;
  const allFailed = photos.length > 0 && failedPhotos.size >= photos.length;
  const currentFailed = failedPhotos.has(photoIndex);
  const dotColor = ratioColor(priceRatio);

  const prev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIndex(i => (i > 0 ? i - 1 : photos.length - 1));
  };
  const next = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIndex(i => (i < photos.length - 1 ? i + 1 : 0));
  };
  const diffPct = priceRatio != null ? Math.round((priceRatio - 1) * 100) : null;

  return (
    <div
      className={`group tactical-panel rounded-lg overflow-hidden flex flex-col sm:flex-row transition-all ${
        isIgnored ? 'opacity-40' : 'hover:border-[#00d4aa40]'
      }`}
      onMouseEnter={() => onListingHover?.(listing)}
      onMouseLeave={() => onListingHover?.(null)}
    >
      {/* Image carousel — fixed width on desktop */}
      <a
        href={listing.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block shrink-0 bg-[#0a1218] overflow-hidden aspect-[4/3] sm:aspect-auto sm:w-96 sm:h-60"
      >
        {photos.length === 0 || allFailed ? (
          <div className="w-full h-full flex items-center justify-center text-gray-700 font-mono text-xs">
            NO IMAGE
          </div>
        ) : currentFailed ? (
          <div className="w-full h-full flex items-center justify-center text-gray-600 font-mono text-[10px] tracking-wider">
            IMAGE UNAVAILABLE
          </div>
        ) : (
          <img
            src={photos[photoIndex]}
            alt={listing.address || listing.title || 'Listing'}
            loading="lazy"
            className={`w-full h-full object-cover ${isIgnored ? 'grayscale' : ''}`}
            onError={() => setFailedPhotos((p) => {
              if (p.has(photoIndex)) return p;
              const n = new Set(p);
              n.add(photoIndex);
              return n;
            })}
          />
        )}

        {/* Price-ratio diamond — matches the listing marker on the map */}
        {priceRatio != null && (
          <div
            className="absolute top-2 left-2"
            style={{ width: 10, height: 10, transform: 'rotate(45deg)', backgroundColor: dotColor, border: '2px solid #05080a', boxShadow: `0 0 8px ${dotColor}99` }}
            title={`${diffPct! > 0 ? '+' : ''}${diffPct}% vs district avg`}
          />
        )}

        {/* Counter */}
        {hasMultiple && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 border border-white/10 font-mono text-[10px] text-white backdrop-blur-sm">
            {photoIndex + 1} / {photos.length}
          </div>
        )}

        {/* Nav arrows on hover */}
        {hasMultiple && (
          <>
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <button
                onClick={prev}
                className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded bg-black/70 backdrop-blur-sm border border-[#00d4aa30] text-[#00d4aa] hover:bg-[#00d4aa] hover:text-black hover:border-[#00d4aa] transition-colors"
                aria-label="Previous photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <button
                onClick={next}
                className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded bg-black/70 backdrop-blur-sm border border-[#00d4aa30] text-[#00d4aa] hover:bg-[#00d4aa] hover:text-black hover:border-[#00d4aa] transition-colors"
                aria-label="Next photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        )}
      </a>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 p-4">
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col gap-2 min-w-0"
        >
          {/* Top row: price + price/m² + diff */}
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-3">
              <span className={`font-mono text-xl font-semibold ${isIgnored ? 'text-gray-500 line-through' : 'text-[#00d4aa]'}`}>
                {formatPrice(listing.price)} zł
              </span>
              <span className="font-mono text-xs text-gray-500">
                {formatPrice(Math.round(listing.pricePerM2))} zł/m²
              </span>
            </div>
            {diffPct !== null && (
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: dotColor }}
                title="vs district avg"
              >
                {diffPct > 0 ? '+' : ''}{diffPct}% vs avg
              </span>
            )}
          </div>

          {/* Specs */}
          <div className="flex items-center gap-2 font-mono text-xs text-gray-400">
            <span>{listing.sizeM2} m²</span>
            {listing.rooms && (
              <>
                <span className="text-gray-700">·</span>
                <span>{listing.rooms} rooms</span>
              </>
            )}
            <span className="text-gray-700">·</span>
            <span className="text-gray-600">{formatDate(listing.scrapedAt)}</span>
          </div>

          {/* Address */}
          <p className={`font-mono text-xs leading-relaxed line-clamp-2 ${isIgnored ? 'text-gray-600 line-through' : 'text-gray-300 group-hover:text-white'}`}>
            {listing.address || listing.title || 'No address'}
          </p>

          {/* Description snippet — fills the empty space below address */}
          {listing.description && (
            <p className={`font-mono text-[11px] leading-relaxed line-clamp-3 ${isIgnored ? 'text-gray-700' : 'text-gray-500'}`}>
              {listing.description}
            </p>
          )}
        </a>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#00d4aa10]">
          <button
            onClick={() => onFavourite?.(listing.id)}
            title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-wider border transition-colors flex items-center gap-1.5 ${
              isFavourite
                ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                : 'border-[#00d4aa20] text-gray-400 hover:text-yellow-400 hover:border-yellow-400/30'
            }`}
          >
            <span>★</span>{isFavourite ? 'SAVED' : 'SAVE'}
          </button>
          <button
            onClick={() => onIgnore?.(listing.id)}
            title={isIgnored ? 'Unignore listing' : 'Ignore listing'}
            className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-wider border transition-colors flex items-center gap-1.5 ${
              isIgnored
                ? 'bg-red-400/15 border-red-400/40 text-red-400'
                : 'border-[#00d4aa20] text-gray-400 hover:text-red-400 hover:border-red-400/30'
            }`}
          >
            <span>⊘</span>{isIgnored ? 'IGNORED' : 'HIDE'}
          </button>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto px-3 py-1 rounded font-mono text-[10px] font-semibold tracking-wider bg-[#00d4aa] text-black hover:bg-[#00e4bb] transition-colors"
          >
            VIEW ON MORIZON →
          </a>
        </div>
      </div>
    </div>
  );
}
