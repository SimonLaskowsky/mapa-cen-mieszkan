'use client';

import { useState } from 'react';

interface ListingDetailProps {
  listing: {
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
  };
  districtAvgPriceM2?: number;
  districtName?: string;
  offerType: 'sale' | 'rent';
  onClose: () => void;
}

export default function ListingDetail({ listing, districtAvgPriceM2, districtName, offerType, onClose }: ListingDetailProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  const formatPrice = (price: number) => new Intl.NumberFormat('pl-PL').format(price);

  // Deal indicator
  const ratio = districtAvgPriceM2 ? listing.pricePerM2 / districtAvgPriceM2 : null;
  const diffPercent = ratio ? ((ratio - 1) * 100) : null;

  let dealLabel = '';
  let dealColor = '';
  if (diffPercent !== null) {
    if (diffPercent <= -15) { dealLabel = 'GREAT DEAL'; dealColor = 'text-blue-400'; }
    else if (diffPercent <= -5) { dealLabel = 'GOOD PRICE'; dealColor = 'text-cyan-400'; }
    else if (diffPercent <= 5) { dealLabel = 'AT AVERAGE'; dealColor = 'text-gray-400'; }
    else if (diffPercent <= 15) { dealLabel = 'ABOVE AVG'; dealColor = 'text-amber-400'; }
    else { dealLabel = 'EXPENSIVE'; dealColor = 'text-red-400'; }
  }

  // Photos: use photos array if available, fall back to single thumbnail
  const photos = listing.photos?.length ? listing.photos : (listing.thumbnailUrl ? [listing.thumbnailUrl] : []);
  const hasMultiplePhotos = photos.length > 1;

  // Property details (only show if data exists)
  const details: { label: string; value: string }[] = [];
  if (listing.floor !== null) details.push({ label: 'FLOOR', value: String(listing.floor) });
  if (listing.buildingYear) details.push({ label: 'BUILT', value: String(listing.buildingYear) });
  if (listing.buildingType) details.push({ label: 'TYPE', value: listing.buildingType.toUpperCase() });
  if (listing.heating) details.push({ label: 'HEATING', value: listing.heating.toUpperCase() });
  if (listing.finishCondition) details.push({ label: 'CONDITION', value: listing.finishCondition.toUpperCase() });

  // Truncated description
  const descriptionText = listing.description || null;
  const isDescLong = descriptionText && descriptionText.length > 200;
  const displayDesc = descExpanded ? descriptionText : descriptionText?.slice(0, 200);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-lg mx-0 sm:mx-4 tactical-panel tactical-panel-bottom rounded-t-xl sm:rounded-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo carousel */}
        {photos.length > 0 && (
          <div className="relative w-full h-52 sm:h-60 bg-[#0a1218] flex-shrink-0">
            <img
              src={photos[photoIndex]}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Deal badge */}
            {dealLabel && (
              <div className="absolute top-3 left-3">
                <span className={`font-mono text-xs font-semibold px-2 py-1 rounded bg-black/70 backdrop-blur-sm ${dealColor}`}>
                  {dealLabel}
                </span>
              </div>
            )}
            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute top-3 right-3">
                <span className="font-mono text-[10px] px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-white">
                  {photoIndex + 1} / {photos.length}
                </span>
              </div>
            )}
            {/* Nav arrows */}
            {hasMultiplePhotos && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex(i => i > 0 ? i - 1 : photos.length - 1); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <span className="font-mono text-sm">&lt;</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex(i => i < photos.length - 1 ? i + 1 : 0); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <span className="font-mono text-sm">&gt;</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Price row */}
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-xl text-[#00d4aa] font-semibold data-glow">
                {formatPrice(listing.price)} zl
              </p>
              <p className="font-mono text-xs text-gray-500 mt-0.5">
                {formatPrice(Math.round(listing.pricePerM2))} zl/m²
              </p>
            </div>
            {diffPercent !== null && (
              <div className="text-right">
                <p className={`font-mono text-sm font-semibold ${dealColor}`}>
                  {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(0)}%
                </p>
                <p className="font-mono text-[10px] text-gray-600">vs district avg</p>
              </div>
            )}
          </div>

          {/* Main stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="tactical-panel rounded p-2 text-center">
              <p className="tactical-label mb-1">SIZE</p>
              <p className="font-mono text-sm text-white">{listing.sizeM2} m²</p>
            </div>
            <div className="tactical-panel rounded p-2 text-center">
              <p className="tactical-label mb-1">ROOMS</p>
              <p className="font-mono text-sm text-white">{listing.rooms ?? '—'}</p>
            </div>
            <div className="tactical-panel rounded p-2 text-center">
              <p className="tactical-label mb-1">{offerType === 'rent' ? 'RENT/M²' : 'PRICE/M²'}</p>
              <p className="font-mono text-sm text-white">{formatPrice(Math.round(listing.pricePerM2))}</p>
            </div>
          </div>

          {/* Extended property details */}
          {details.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {details.map((d) => (
                <div key={d.label} className="tactical-panel rounded p-2 text-center">
                  <p className="tactical-label mb-1">{d.label}</p>
                  <p className="font-mono text-xs text-white truncate">{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Address */}
          {listing.address && (
            <div>
              <p className="tactical-label mb-1">ADDRESS</p>
              <p className="font-mono text-xs text-gray-300">{listing.address}</p>
            </div>
          )}

          {/* Description */}
          {descriptionText && (
            <div>
              <p className="tactical-label mb-1">DESCRIPTION</p>
              <p className="font-mono text-xs text-gray-400 leading-relaxed whitespace-pre-line">
                {displayDesc}
                {isDescLong && !descExpanded && '...'}
              </p>
              {isDescLong && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="font-mono text-[10px] text-[#00d4aa] hover:text-white mt-1 transition-colors"
                >
                  {descExpanded ? 'SHOW LESS' : 'SHOW MORE'}
                </button>
              )}
            </div>
          )}

          {/* District context */}
          {districtName && districtAvgPriceM2 && (
            <div className="flex items-center gap-3 py-2 border-t border-[#00d4aa10]">
              <div className="flex-1">
                <p className="tactical-label mb-1">DISTRICT</p>
                <p className="font-mono text-xs text-white">{districtName.toUpperCase().replace(/-/g, ' ')}</p>
              </div>
              <div className="text-right">
                <p className="tactical-label mb-1">AVG PRICE/M²</p>
                <p className="font-mono text-xs text-gray-400">{formatPrice(Math.round(districtAvgPriceM2))} zl</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 rounded font-mono text-xs font-semibold tracking-widest bg-[#00d4aa] text-black hover:bg-[#00e4bb] transition-colors text-center"
            >
              VIEW ON MORIZON
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded font-mono text-xs text-gray-400 hover:text-white border border-[#00d4aa20] hover:border-[#00d4aa40] transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
