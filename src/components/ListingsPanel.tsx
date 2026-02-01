'use client';

import { useEffect, useState } from 'react';

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
  scrapedAt: string;
}

interface ListingsPanelProps {
  city: string;
  district: string;
  onListingHover?: (listing: Listing | null) => void;
  onClose: () => void;
}

export default function ListingsPanel({ city, district, onListingHover, onClose }: ListingsPanelProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        ) : listings.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500 font-mono text-xs">NO LISTINGS WITH COORDINATES</div>
            <div className="text-gray-600 font-mono text-[10px] mt-1">Geocoding in progress...</div>
          </div>
        ) : (
          <div className="divide-y divide-[#00d4aa10]">
            {listings.map((listing) => (
              <a
                key={listing.id}
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 hover:bg-[#00d4aa08] transition-colors group"
                onMouseEnter={() => onListingHover?.(listing)}
                onMouseLeave={() => onListingHover?.(null)}
              >
                {/* Title / Address */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-gray-300 truncate group-hover:text-[#00d4aa] transition-colors">
                      {listing.address || listing.title || 'No address'}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-gray-600 flex-shrink-0">
                    {formatDate(listing.scrapedAt)}
                  </span>
                </div>

                {/* Details */}
                <div className="flex items-center gap-3 text-xs">
                  {/* Price */}
                  <div className="flex items-center gap-1">
                    <span className="text-[#00d4aa] font-mono font-semibold">
                      {formatPrice(listing.price)} zł
                    </span>
                  </div>

                  <span className="text-gray-700">|</span>

                  {/* Size */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-mono">{listing.sizeM2} m²</span>
                  </div>

                  {/* Rooms */}
                  {listing.rooms && (
                    <>
                      <span className="text-gray-700">|</span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-mono">{listing.rooms} rm</span>
                      </div>
                    </>
                  )}

                  <span className="text-gray-700">|</span>

                  {/* Price per m2 */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 font-mono text-[10px]">
                      {formatPrice(Math.round(listing.pricePerM2))} zł/m²
                    </span>
                  </div>
                </div>

                {/* External link indicator */}
                <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>MORIZON</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {listings.length > 0 && (
        <div className="p-2 border-t border-[#00d4aa15] flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-600">
              {listings.length} LISTINGS SHOWN
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
