'use client';

import { useEffect, useState, useMemo } from 'react';

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
}

type ListingFilter = 'all' | 'favs' | 'hide-ignored';

interface ListingsPanelProps {
  city: string;
  district: string;
  onListingHover?: (listing: Listing | null) => void;
  onClose: () => void;
  ignoredListings?: Set<string>;
  favouriteListings?: Set<string>;
  onIgnore?: (id: string) => void;
  onFavourite?: (id: string) => void;
}

export default function ListingsPanel({ city, district, onListingHover, onClose, ignoredListings, favouriteListings, onIgnore, onFavourite }: ListingsPanelProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListingFilter>('all');

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/listings?city=${city}&district=${district}&limit=20`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setListings(data.listings || []);
      } catch (err) {
        setError('Failed to load listings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [city, district]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pl-PL').format(price);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  };

  // Sort and filter listings: favourites first, then normal, then ignored
  const sortedAndFilteredListings = useMemo(() => {
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
  }, [listings, filter, ignoredListings, favouriteListings]);

  const favCount = listings.filter(l => favouriteListings?.has(l.id)).length;
  const ignoredCount = listings.filter(l => ignoredListings?.has(l.id)).length;

  return (
    <div className="tactical-panel rounded-lg overflow-hidden flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="p-3 border-b border-[#00d4aa15] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
          <span className="tactical-label">ACTIVE LISTINGS</span>
          <span className="font-mono text-xs text-[#00d4aa]">{district.toUpperCase().replace(/-/g, ' ')}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Filter Bar */}
      {listings.length > 0 && (
        <div className="px-3 py-2 border-b border-[#00d4aa10] flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
              filter === 'all'
                ? 'bg-[#00d4aa] text-black'
                : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setFilter('favs')}
            className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
              filter === 'favs'
                ? 'bg-[#eab308] text-black'
                : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
            }`}
          >
            ★ FAVS{favCount > 0 ? ` (${favCount})` : ''}
          </button>
          <button
            onClick={() => setFilter('hide-ignored')}
            className={`px-2 py-1 rounded font-mono text-[10px] transition-colors ${
              filter === 'hide-ignored'
                ? 'bg-[#00d4aa] text-black'
                : 'bg-[#00d4aa15] text-gray-400 hover:bg-[#00d4aa25]'
            }`}
          >
            HIDE IGNORED{ignoredCount > 0 ? ` (${ignoredCount})` : ''}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center">
            <div className="text-[#00d4aa] font-mono text-xs animate-pulse">FETCHING LISTINGS...</div>
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <div className="text-red-400 font-mono text-xs">{error}</div>
          </div>
        ) : sortedAndFilteredListings.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500 font-mono text-xs">
              {listings.length === 0 ? 'NO LISTINGS WITH COORDINATES' : filter === 'favs' ? 'NO FAVOURITES YET' : 'ALL LISTINGS IGNORED'}
            </div>
            {listings.length === 0 && (
              <div className="text-gray-600 font-mono text-[10px] mt-1">Geocoding in progress...</div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#00d4aa10]">
            {sortedAndFilteredListings.map((listing) => {
              const isIgnored = ignoredListings?.has(listing.id);
              const isFavourite = favouriteListings?.has(listing.id);

              return (
                <div
                  key={listing.id}
                  className={`flex gap-3 p-3 transition-colors group ${isIgnored ? 'opacity-40' : 'hover:bg-[#00d4aa08]'}`}
                  onMouseEnter={() => onListingHover?.(listing)}
                  onMouseLeave={() => onListingHover?.(null)}
                >
                  {/* Thumbnail */}
                  {listing.thumbnailUrl && (
                    <div className="flex-shrink-0">
                      <a href={listing.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={listing.thumbnailUrl}
                          alt=""
                          className={`w-16 h-12 object-cover rounded border border-[#00d4aa20] ${isIgnored ? 'grayscale' : ''}`}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </a>
                    </div>
                  )}

                  {/* Content */}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0"
                  >
                    {/* Title / Address */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`font-mono text-xs truncate transition-colors ${isIgnored ? 'text-gray-600 line-through' : 'text-gray-300 group-hover:text-[#00d4aa]'}`}>
                        {listing.address || listing.title || 'No address'}
                      </p>
                      <span className="font-mono text-[10px] text-gray-600 flex-shrink-0">
                        {formatDate(listing.scrapedAt)}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className={`font-mono font-semibold ${isIgnored ? 'text-gray-600 line-through' : 'text-[#00d4aa]'}`}>
                        {formatPrice(listing.price)} zł
                      </span>
                      <span className="text-gray-700">|</span>
                      <span className="text-gray-400 font-mono">{listing.sizeM2} m²</span>
                      {listing.rooms && (
                        <>
                          <span className="text-gray-700">|</span>
                          <span className="text-gray-400 font-mono">{listing.rooms} rm</span>
                        </>
                      )}
                      <span className="text-gray-700">|</span>
                      <span className="text-gray-500 font-mono text-[10px]">
                        {formatPrice(Math.round(listing.pricePerM2))} zł/m²
                      </span>
                    </div>
                  </a>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-1 flex-shrink-0 items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onFavourite?.(listing.id); }}
                      title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                      className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-sm ${
                        isFavourite
                          ? 'text-yellow-400 bg-yellow-400/15 hover:bg-yellow-400/25'
                          : 'text-gray-600 hover:text-yellow-400 hover:bg-yellow-400/10'
                      }`}
                    >
                      ★
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onIgnore?.(listing.id); }}
                      title={isIgnored ? 'Unignore listing' : 'Ignore listing'}
                      className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-sm ${
                        isIgnored
                          ? 'text-red-400 bg-red-400/15 hover:bg-red-400/25'
                          : 'text-gray-600 hover:text-red-400 hover:bg-red-400/10'
                      }`}
                    >
                      ⊘
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {listings.length > 0 && (
        <div className="p-2 border-t border-[#00d4aa15] flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-600">
              {sortedAndFilteredListings.length}/{listings.length} LISTINGS SHOWN
            </span>
            <span className="font-mono text-[10px] text-gray-600">
              CLICK TO VIEW ON MORIZON
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
