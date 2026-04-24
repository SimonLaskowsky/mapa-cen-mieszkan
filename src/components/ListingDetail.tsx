'use client';

import { useState } from 'react';
import { morizonPhotoAtSize } from '@/lib/photoUrl';

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
  isFavourite?: boolean;
  isIgnored?: boolean;
  onFavourite?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onClose: () => void;
}

export default function ListingDetail({ listing, districtAvgPriceM2, districtName, offerType, isFavourite, isIgnored, onFavourite, onIgnore, onClose }: ListingDetailProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set());

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

  // Photos: use photos array if available, fall back to single thumbnail.
  // Modal shows photos large, so request the xl size variant from the CDN.
  const rawPhotos = listing.photos?.length ? listing.photos : (listing.thumbnailUrl ? [listing.thumbnailUrl] : []);
  const photos = rawPhotos.map((u) => morizonPhotoAtSize(u, 'xl'));
  const hasMultiplePhotos = photos.length > 1;
  const allPhotosFailed = photos.length > 0 && failedPhotos.size >= photos.length;
  const currentPhotoFailed = failedPhotos.has(photoIndex);

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
        {/* Photo carousel. If every photo fails to load (typically hot-link
            protection on the source CDN) we collapse it entirely rather than
            leave an empty dark box with dangling counter and arrows. */}
        {photos.length > 0 && !allPhotosFailed && (
          <div className="relative w-full h-52 sm:h-60 bg-[#0a1218] flex-shrink-0">
            {currentPhotoFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-mono text-[10px] tracking-wider">IMAGE UNAVAILABLE</span>
              </div>
            ) : (
              <img
                src={photos[photoIndex]}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setFailedPhotos((prev) => {
                  if (prev.has(photoIndex)) return prev;
                  const next = new Set(prev);
                  next.add(photoIndex);
                  return next;
                })}
              />
            )}
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
            {/* Nav arrows. inset-y-0 + flex items-center pins each arrow to
                the exact vertical center of the carousel regardless of how the
                image renders, which is more robust than top-1/2 + translate. */}
            {hasMultiplePhotos && (
              <>
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoIndex(i => i > 0 ? i - 1 : photos.length - 1); }}
                    className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded bg-black/70 backdrop-blur-sm border border-[#00d4aa30] text-[#00d4aa] hover:bg-[#00d4aa] hover:text-black hover:border-[#00d4aa] transition-colors"
                    aria-label="Previous photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoIndex(i => i < photos.length - 1 ? i + 1 : 0); }}
                    className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded bg-black/70 backdrop-blur-sm border border-[#00d4aa30] text-[#00d4aa] hover:bg-[#00d4aa] hover:text-black hover:border-[#00d4aa] transition-colors"
                    aria-label="Next photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
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
          <div className="flex flex-col gap-2">
            {/* Save / Ignore row */}
            <div className="flex gap-2">
              {onFavourite && (
                <button
                  onClick={() => onFavourite(listing.id)}
                  className={`flex-1 py-2 rounded font-mono text-xs font-semibold tracking-wider border transition-colors flex items-center justify-center gap-1.5 ${
                    isFavourite
                      ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
                      : 'border-[#00d4aa20] text-gray-400 hover:text-yellow-400 hover:border-yellow-400/30'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill={isFavourite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {isFavourite ? 'SAVED' : 'SAVE'}
                </button>
              )}
              {onIgnore && (
                <button
                  onClick={() => onIgnore(listing.id)}
                  className={`flex-1 py-2 rounded font-mono text-xs font-semibold tracking-wider border transition-colors flex items-center justify-center gap-1.5 ${
                    isIgnored
                      ? 'bg-red-400/15 border-red-400/40 text-red-400'
                      : 'border-[#00d4aa20] text-gray-400 hover:text-red-400 hover:border-red-400/30'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  {isIgnored ? 'IGNORED' : 'HIDE'}
                </button>
              )}
            </div>
            {/* Primary actions row */}
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
    </div>
  );
}
