'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITIES, findCityAtPoint } from '@/lib/cities';
import { formatPrice, formatPercent, type DistrictStats, type CityData } from '@/lib/city-data';
import { useSoundEffects } from '@/lib/useSoundEffects';

interface Listing {
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
}

// ============================================
// FEATURE FLAG: Restrict map panning to city bounds
// Set to false to allow free scrolling across all cities
// ============================================
const RESTRICT_TO_CITY_BOUNDS = true;

// Map frontend city IDs to API slugs
const CITY_API_SLUGS: Record<string, string> = {
  warsaw: 'warszawa',
  krakow: 'krakow',
  wroclaw: 'wroclaw',
  katowice: 'katowice',
  gdansk: 'gdansk',
  poznan: 'poznan',
  lodz: 'lodz',
};

interface SearchLocation {
  lat: number;
  lng: number;
  displayName: string;
}

interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  rooms?: number[];
}

interface MapProps {
  cityId: string;
  cityData: CityData;
  offerType?: 'sale' | 'rent';
  onCityChange?: (cityId: string) => void;
  onDistrictSelect?: (district: DistrictStats | null) => void;
  searchLocation?: SearchLocation | null;
  focusedDistrict?: string | null;
  onDistrictClick?: (district: string | null) => void;
  showListings?: boolean;
  showDistrictLabels?: boolean;
  showHeatmap?: boolean;
  showDistrictFill?: boolean;
  listingFilters?: ListingFilters;
  hoveredListingId?: string;
  ignoredListings?: Set<string>;
  favouriteListings?: Set<string>;
}

// Get price tier (1-6) for color coding based on offer type
function getPriceTier(price: number, offerType: 'sale' | 'rent' = 'sale'): number {
  if (offerType === 'rent') {
    // Rent tiers (monthly price)
    if (price < 2500) return 1;
    if (price < 3500) return 2;
    if (price < 4500) return 3;
    if (price < 5500) return 4;
    if (price < 7000) return 5;
    return 6;
  } else {
    // Sale tiers (price per m²)
    if (price < 12000) return 1;
    if (price < 14000) return 2;
    if (price < 16000) return 3;
    if (price < 18000) return 4;
    if (price < 22000) return 5;
    return 6;
  }
}

// Get color for price tier
function getTierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: '#22c55e',
    2: '#84cc16',
    3: '#eab308',
    4: '#f97316',
    5: '#ef4444',
    6: '#dc2626',
  };
  return colors[tier] || '#666';
}

// Get color for a listing based on its price relative to district average
function getPriceRatioColor(pricePerM2: number, avgPriceM2: number): string {
  const ratio = pricePerM2 / avgPriceM2;
  if (ratio <= 0.7) return '#22c55e';
  if (ratio <= 0.85) return '#84cc16';
  if (ratio <= 1.0) return '#eab308';
  if (ratio <= 1.15) return '#f97316';
  return '#ef4444';
}

// Generate price bar visualization (█░)
function getPriceBars(tier: number): string {
  const filled = tier;
  const empty = 6 - tier;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getPriceThreatLevel(price: number, offerType: 'sale' | 'rent' = 'sale'): { label: string; color: string } {
  if (offerType === 'rent') {
    if (price < 2500) return { label: 'LOW', color: '#22c55e' };
    if (price < 3500) return { label: 'MODERATE', color: '#84cc16' };
    if (price < 4500) return { label: 'ELEVATED', color: '#eab308' };
    if (price < 5500) return { label: 'HIGH', color: '#f97316' };
    if (price < 7000) return { label: 'SEVERE', color: '#ef4444' };
    return { label: 'CRITICAL', color: '#dc2626' };
  } else {
    if (price < 12000) return { label: 'LOW', color: '#22c55e' };
    if (price < 14000) return { label: 'MODERATE', color: '#84cc16' };
    if (price < 16000) return { label: 'ELEVATED', color: '#eab308' };
    if (price < 18000) return { label: 'HIGH', color: '#f97316' };
    if (price < 22000) return { label: 'SEVERE', color: '#ef4444' };
    return { label: 'CRITICAL', color: '#dc2626' };
  }
}

export default function Map({ cityId, cityData, offerType = 'sale', onCityChange, onDistrictSelect, searchLocation, focusedDistrict, onDistrictClick, showListings = true, showDistrictLabels = true, showHeatmap = true, showDistrictFill = true, listingFilters, hoveredListingId, ignoredListings, favouriteListings }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const listingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const listingMarkerElementsRef = useRef<Record<string, HTMLElement>>({});
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const currentCityRef = useRef(cityId);
  const cityDataRef = useRef(cityData);
  const onDistrictClickRef = useRef(onDistrictClick);
  const showDistrictLabelsRef = useRef(showDistrictLabels);
  const showListingsRef = useRef(showListings);
  const offerTypeRef = useRef(offerType);
  const [listings, setListings] = useState<Listing[]>([]);
  const { playSound } = useSoundEffects();
  const playSoundRef = useRef(playSound);
  const ignoredListingsRef = useRef(ignoredListings);
  const favouriteListingsRef = useRef(favouriteListings);

  // Get current city config
  const cityConfig = CITIES[cityId];

  // Keep refs updated
  useEffect(() => {
    cityDataRef.current = cityData;
  }, [cityData]);

  useEffect(() => {
    ignoredListingsRef.current = ignoredListings;
  }, [ignoredListings]);

  useEffect(() => {
    favouriteListingsRef.current = favouriteListings;
  }, [favouriteListings]);

  useEffect(() => {
    onDistrictClickRef.current = onDistrictClick;
  }, [onDistrictClick]);

  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  useEffect(() => {
    offerTypeRef.current = offerType;
  }, [offerType]);

  useEffect(() => {
    showDistrictLabelsRef.current = showDistrictLabels;
  }, [showDistrictLabels]);

  useEffect(() => {
    showListingsRef.current = showListings;
  }, [showListings]);

  // Remove existing markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  // Remove listing markers
  const clearListingMarkers = useCallback(() => {
    listingMarkersRef.current.forEach(marker => marker.remove());
    listingMarkersRef.current = [];
    listingMarkerElementsRef.current = {};
  }, []);

  // Add listing markers to map
  const addListingMarkers = useCallback((mapInstance: maplibregl.Map, listingsData: Listing[], avgPriceM2?: number) => {
    clearListingMarkers();

    // Detect overlapping coordinates and offset them
    const coordCounts: Record<string, number> = {};
    const coordIndices: Record<string, number> = {};
    listingsData.forEach((listing) => {
      const key = `${listing.lat.toFixed(5)},${listing.lng.toFixed(5)}`;
      coordCounts[key] = (coordCounts[key] || 0) + 1;
    });

    console.log('Listing data', listingsData)
    listingsData.forEach((listing, index) => {
      const priceK = Math.round(listing.price / 1000);
      const priceM2K = (listing.pricePerM2 / 1000).toFixed(1);
      const pulseColor = avgPriceM2 ? getPriceRatioColor(listing.pricePerM2, avgPriceM2) : '#00d4aa';

      // Offset duplicates in a circle around the original point
      const key = `${listing.lat.toFixed(5)},${listing.lng.toFixed(5)}`;
      const total = coordCounts[key] || 1;
      const dupIndex = coordIndices[key] || 0;
      coordIndices[key] = dupIndex + 1;

      let offsetLat = 0;
      let offsetLng = 0;
      if (total > 1) {
        const angle = (2 * Math.PI * dupIndex) / total;
        const radius = 0.0003; // ~30m offset
        offsetLat = Math.cos(angle) * radius;
        offsetLng = Math.sin(angle) * radius;
      }

      const el = document.createElement('div');
      console.log('Listing thumbnail url:',listing.thumbnailUrl);
      el.className = 'listing-marker';
      el.style.cssText = `
        width: 0;
        height: 0;
        cursor: pointer;
        z-index: ${index + 1};
      `;
      el.innerHTML = `
        <div class="listing-marker-dot" style="
          position: absolute;
          top: -5px;
          left: -5px;
          width: 10px;
          height: 10px;
          background: ${pulseColor};
          border: 2px solid #05080a;
          transform: rotate(45deg);
          box-shadow: 0 0 8px rgba(0,212,170,0.6);
          transition: all 0.2s ease;
          transform-origin: center;
        "></div>
        <div class="listing-marker-pulse" style="
          position: absolute;
          top: -12px;
          left: -12px;
          width: 24px;
          height: 24px;
          border: 1px solid rgba(0,212,170,0.4);
          border-radius: 50%;
          animation: listing-pulse 2s ease-out infinite;
          pointer-events: none;
        "></div>
        <div class="listing-marker-tooltip" style="
          position: absolute;
          bottom: 12px;
          left: 0;
          transform: translateX(-50%);
          background: rgba(5,8,10,0.95);
          border: 1px solid rgba(0,212,170,0.5);
          border-radius: 4px;
          padding: 6px;
          font-family: ui-monospace, monospace;
          font-size: 10px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          min-width: 140px;
        ">
          ${listing.thumbnailUrl ? `
            <img src="${listing.thumbnailUrl}" alt="" style="
              width: 140px;
              height: 80px;
              object-fit: cover;
              border-radius: 2px;
              margin-bottom: 6px;
              display: block;
            " onerror="this.style.display='none'" />
          ` : ''}
          <div style="color: #00d4aa; font-weight: 600;">${priceK}K PLN</div>
          <div style="color: rgba(255,255,255,0.6); margin-top: 2px;">${listing.sizeM2}m² · ${priceM2K}K/m²</div>
          ${listing.rooms ? `<div style="color: rgba(255,255,255,0.4);">${listing.rooms} rooms</div>` : ''}
        </div>
      `;

      // Hover effects
      el.addEventListener('mouseenter', () => {
        const tooltip = el.querySelector('.listing-marker-tooltip') as HTMLElement;
        const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
        if (tooltip) tooltip.style.opacity = '1';
        if (dot) {
          dot.style.transform = 'rotate(45deg) scale(1.5)';
          dot.style.boxShadow = '0 0 15px rgba(0,212,170,0.9)';
        }
      });
      el.addEventListener('mouseleave', () => {
        const tooltip = el.querySelector('.listing-marker-tooltip') as HTMLElement;
        const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
        if (tooltip) tooltip.style.opacity = '0';
        if (dot) {
          dot.style.transform = 'rotate(45deg) scale(1)';
          dot.style.boxShadow = '0 0 8px rgba(0,212,170,0.6)';
        }
      });

      // Click opens listing URL in background tab
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('ping');
        const a = document.createElement('a');
        a.href = listing.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      });

      el.style.display = showListingsRef.current ? 'block' : 'none';

      // Store element reference by listing ID for hover highlighting
      listingMarkerElementsRef.current[listing.id] = el;

      // Apply ignore/favourite styles at creation time
      const isIgnored = ignoredListingsRef.current?.has(listing.id);
      const isFavourite = favouriteListingsRef.current?.has(listing.id);
      if (isIgnored) {
        el.style.filter = 'grayscale(1)';
        const pulse = el.querySelector('.listing-marker-pulse') as HTMLElement;
        if (pulse) pulse.style.display = 'none';
      } else if (isFavourite) {
        const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
        if (dot) {
          dot.style.border = '2px solid #eab308';
          dot.style.boxShadow = '0 0 12px rgba(234,179,8,0.7)';
          dot.style.transform = 'rotate(45deg) scale(1.2)';
        }
      }

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([listing.lng + offsetLng, listing.lat + offsetLat])
        .addTo(mapInstance);

      listingMarkersRef.current.push(marker);
    });
  }, [clearListingMarkers, playSound]);

  // Add markers for districts
  const addMarkers = useCallback((mapInstance: maplibregl.Map, data: typeof cityData) => {
    clearMarkers();

    data.DISTRICT_CENTERS.forEach((district) => {
      const stats = district.stats;
      // Use appropriate price based on offer type
      const displayPrice = offerType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2;
      const tier = getPriceTier(displayPrice, offerType);
      const color = getTierColor(tier);
      const bars = getPriceBars(tier);
      const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
      const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
      const displayName = district.displayName || district.name;

      const el = document.createElement('div');
      el.className = 'district-marker';
      const minPrice = stats.minPriceM2;
      const maxPrice = stats.maxPriceM2;
      const rangeHtml = minPrice && maxPrice && offerType === 'sale'
        ? `<div class="marker-range"><span class="marker-range-low">${(minPrice / 1000).toFixed(1)}k</span><span class="marker-range-sep">–</span><span class="marker-range-high">${(maxPrice / 1000).toFixed(1)}k</span></div>`
        : '';

      el.innerHTML = `
        <div class="district-marker-content" style="--tier-color: ${color};">
          <div class="marker-name">${displayName}</div>
          <div class="marker-bars" style="color: ${color};">${bars}</div>
          <div class="marker-price">${(displayPrice / 1000).toFixed(1)}k</div>
          ${rangeHtml}
          <div class="marker-meta">
            <span class="marker-listings">${stats.listingCount}</span>
            <span class="marker-change" style="color: ${changeColor};">${changeIcon}${Math.abs(stats.change30d).toFixed(1)}%</span>
          </div>
        </div>
      `;

      el.style.display = showDistrictLabelsRef.current ? 'block' : 'none';

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([district.lng, district.lat])
        .addTo(mapInstance);

      markersRef.current.push(marker);
    });
  }, [clearMarkers, offerType]);

  // Update map layers with new city data
  const updateMapData = useCallback((mapInstance: maplibregl.Map, data: typeof cityData) => {
    // Prepare GeoJSON with price colors
    const geoJSONWithPrices = {
      type: 'FeatureCollection' as const,
      features: data.DISTRICTS_GEOJSON.features.map((feature) => {
        const stats = data.DISTRICT_STATS[feature.properties.name];
        const displayPrice = stats ? (offerType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2) : 0;
        const tier = stats ? getPriceTier(displayPrice, offerType) : 3;
        return {
          type: 'Feature' as const,
          id: feature.id,
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            priceTier: tier,
            color: getTierColor(tier),
          },
        };
      }),
    };

    // Update or add source
    const source = mapInstance.getSource('districts') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(geoJSONWithPrices as GeoJSON.FeatureCollection);
    }

    // Update markers
    addMarkers(mapInstance, data);
  }, [addMarkers]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Add padding to bounds so districts at edges aren't cut off
    const paddedBounds = RESTRICT_TO_CITY_BOUNDS ? [
      [cityConfig.bounds[0][0] - 0.02, cityConfig.bounds[0][1] - 0.02], // SW with padding
      [cityConfig.bounds[1][0] + 0.02, cityConfig.bounds[1][1] + 0.02], // NE with padding
    ] as [[number, number], [number, number]] : undefined;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: cityConfig.center,
      zoom: cityConfig.zoom,
      minZoom: 8,
      maxZoom: 16,
      maxBounds: paddedBounds,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    popup.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '320px',
      offset: 25,
    });

    // Auto-detect city on moveend
    map.current.on('moveend', () => {
      if (!map.current || !onCityChange) return;

      const center = map.current.getCenter();
      const detectedCity = findCityAtPoint(center.lng, center.lat);

      if (detectedCity && detectedCity !== currentCityRef.current) {
        currentCityRef.current = detectedCity;
        onCityChange(detectedCity);
      }
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Prepare initial GeoJSON
      const geoJSONWithPrices = {
        type: 'FeatureCollection' as const,
        features: cityData.DISTRICTS_GEOJSON.features.map((feature) => {
          const stats = cityData.DISTRICT_STATS[feature.properties.name];
          const displayPrice = stats ? (offerType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2) : 0;
          const tier = stats ? getPriceTier(displayPrice, offerType) : 3;
          return {
            type: 'Feature' as const,
            id: feature.id,
            geometry: feature.geometry,
            properties: {
              ...feature.properties,
              priceTier: tier,
              color: getTierColor(tier),
            },
          };
        }),
      };

      map.current.addSource('districts', {
        type: 'geojson',
        data: geoJSONWithPrices as GeoJSON.FeatureCollection,
      });

      // District fill
      map.current.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': showDistrictFill ? [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.35,
            0.15
          ] : 0,
        },
      });

      // District borders
      map.current.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0.6
          ],
        },
      });

      // Add markers
      addMarkers(map.current, cityData);

      // Interactions
      let hoveredId: string | number | null = null;

      map.current.on('mousemove', 'district-fill', (e) => {
        if (!map.current || !e.features?.[0]) return;

        map.current.getCanvas().style.cursor = 'pointer';

        const newId = e.features[0].id ?? null;

        // Only play sound when entering a NEW district
        if (newId !== hoveredId && newId !== null) {
          playSoundRef.current('tick');
        }

        if (hoveredId !== null) {
          map.current.setFeatureState(
            { source: 'districts', id: hoveredId },
            { hover: false }
          );
        }

        hoveredId = newId;
        if (hoveredId !== null) {
          map.current.setFeatureState(
            { source: 'districts', id: hoveredId },
            { hover: true }
          );
        }
      });

      map.current.on('mouseleave', 'district-fill', () => {
        if (!map.current) return;

        map.current.getCanvas().style.cursor = '';

        if (hoveredId !== null) {
          map.current.setFeatureState(
            { source: 'districts', id: hoveredId },
            { hover: false }
          );
        }
        hoveredId = null;
      });

      // Click handler
      map.current.on('click', 'district-fill', (e) => {
        if (!map.current || !popup.current || !e.features?.[0]) return;
        playSoundRef.current('pop');

        const feature = e.features[0];
        const name = feature.properties?.name;
        const currentData = cityDataRef.current;
        const districtData = currentData.DISTRICT_CENTERS.find(d => d.name === name);

        if (!districtData) return;

        const stats = districtData.stats;
        const coordinates = e.lngLat;
        const currentOfferType = offerTypeRef.current;
        const popupDisplayPrice = currentOfferType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2;
        const tier = getPriceTier(popupDisplayPrice, currentOfferType);
        const tierColor = getTierColor(tier);
        const displayName = districtData.displayName || districtData.name;

        const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
        const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
        const threatLevel = getPriceThreatLevel(popupDisplayPrice, currentOfferType);

        const priceLabel = currentOfferType === 'rent' ? 'AVG RENT/MONTH' : 'AVG PRICE/M²';
        const medianLabel = currentOfferType === 'rent' ? 'MEDIAN RENT' : 'MEDIAN/M²';

        const html = `
          <div style="font-family: ui-monospace, monospace;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid ${tierColor}40;">
              <span style="font-size: 14px; font-weight: 600; color: white;">${displayName.toUpperCase()}</span>
              <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${tierColor}20; color: ${tierColor}; border: 1px solid ${tierColor}40;">${threatLevel.label}</span>
            </div>
            <div style="display: grid; gap: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">${priceLabel}</span>
                <span style="color: ${tierColor}; font-weight: 600;">${formatPrice(popupDisplayPrice)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">${medianLabel}</span>
                <span style="color: white;">${formatPrice(currentOfferType === 'rent' ? (stats.medianPriceM2 * (stats.avgSize || 50)) : stats.medianPriceM2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">30D CHANGE</span>
                <span style="color: ${changeColor};">${changeIcon} ${formatPercent(stats.change30d)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">LISTINGS</span>
                <span style="color: white;">${stats.listingCount}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">AVG SIZE</span>
                <span style="color: white;">${stats.avgSize} m²</span>
              </div>
              ${stats.rentalYield ? `<div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">GROSS YIELD</span>
                <span style="color: ${stats.rentalYield >= 5 ? '#22c55e' : stats.rentalYield >= 4 ? '#eab308' : '#ef4444'}; font-weight: 600;">${stats.rentalYield.toFixed(1)}%</span>
              </div>` : ''}
            </div>
          </div>
        `;

        popup.current.setLngLat(coordinates).setHTML(html).addTo(map.current);
        onDistrictSelect?.(stats);
        onDistrictClickRef.current?.(name);
      });
    });

    return () => {
      clearMarkers();
      clearListingMarkers();
      if (popup.current) popup.current.remove();
      if (map.current) map.current.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle city/data change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    currentCityRef.current = cityId;
    const config = CITIES[cityId];

    // Update bounds restriction when city changes
    if (RESTRICT_TO_CITY_BOUNDS) {
      const paddedBounds: [[number, number], [number, number]] = [
        [config.bounds[0][0] - 0.02, config.bounds[0][1] - 0.02],
        [config.bounds[1][0] + 0.02, config.bounds[1][1] + 0.02],
      ];
      map.current.setMaxBounds(paddedBounds);
    }

    // Fly to new city
    map.current.flyTo({
      center: config.center,
      zoom: config.zoom,
      duration: 1500,
    });

    // Update data with current cityData
    updateMapData(map.current, cityData);

    // Close any open popup and clear listing markers/heatmap
    if (popup.current) popup.current.remove();
    clearListingMarkers();
    if (map.current.getLayer('listings-heat')) map.current.removeLayer('listings-heat');
    if (map.current.getSource('listings-data')) map.current.removeSource('listings-data');
    if (map.current.getSource('listings-heat-data')) map.current.removeSource('listings-heat-data');
  }, [cityId, cityData, updateMapData, clearListingMarkers]);

  // Handle search location marker
  useEffect(() => {
    if (!map.current) return;

    // Remove existing search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    // Add new marker if location provided
    if (searchLocation) {
      // Create tactical marker element with inline styles for reliability
      const el = document.createElement('div');
      el.className = 'search-marker';
      el.style.cssText = 'position: relative; width: 80px; height: 80px; overflow: visible;';
      el.innerHTML = `
        <div class="search-marker-ring search-marker-ring-1" style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 2px solid #00d4aa; border-radius: 50%; transform: translate(-50%, -50%);"></div>
        <div class="search-marker-ring search-marker-ring-2" style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 2px solid #00d4aa; border-radius: 50%; transform: translate(-50%, -50%);"></div>
        <div class="search-marker-ring search-marker-ring-3" style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 2px solid #00d4aa; border-radius: 50%; transform: translate(-50%, -50%);"></div>
        <div class="search-marker-crosshair search-marker-crosshair-h" style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #00d4aa; transform: translateY(-50%);"></div>
        <div class="search-marker-crosshair search-marker-crosshair-v" style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #00d4aa; transform: translateX(-50%);"></div>
        <div class="search-marker-core" style="position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; background: #00d4aa; transform: translate(-50%, -50%) rotate(45deg); box-shadow: 0 0 10px #00d4aa, 0 0 20px rgba(0,212,170,0.5); z-index: 10;"></div>
        <div class="search-marker-bracket search-marker-bracket-tl" style="position: absolute; top: 8px; left: 8px; width: 12px; height: 12px; border-top: 2px solid #00d4aa; border-left: 2px solid #00d4aa;"></div>
        <div class="search-marker-bracket search-marker-bracket-tr" style="position: absolute; top: 8px; right: 8px; width: 12px; height: 12px; border-top: 2px solid #00d4aa; border-right: 2px solid #00d4aa;"></div>
        <div class="search-marker-bracket search-marker-bracket-bl" style="position: absolute; bottom: 8px; left: 8px; width: 12px; height: 12px; border-bottom: 2px solid #00d4aa; border-left: 2px solid #00d4aa;"></div>
        <div class="search-marker-bracket search-marker-bracket-br" style="position: absolute; bottom: 8px; right: 8px; width: 12px; height: 12px; border-bottom: 2px solid #00d4aa; border-right: 2px solid #00d4aa;"></div>
        <div class="search-marker-label" style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 8px; background: rgba(5,8,10,0.95); border: 1px solid rgba(0,212,170,0.4); border-radius: 4px; padding: 6px 12px; font-family: ui-monospace, monospace; font-size: 10px; color: #00d4aa; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap;">TARGET LOCATED</div>
      `;

      searchMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([searchLocation.lng, searchLocation.lat])
        .addTo(map.current);

      // Fly to location
      map.current.flyTo({
        center: [searchLocation.lng, searchLocation.lat],
        zoom: 15,
        duration: 1500,
      });
    }
  }, [searchLocation]);

  // Handle focused district from panel click
  useEffect(() => {
    if (!map.current || !popup.current || !focusedDistrict) return;

    const currentData = cityDataRef.current;
    const districtData = currentData.DISTRICT_CENTERS.find(d => d.name === focusedDistrict);

    if (!districtData) return;

    const stats = districtData.stats;
    const coordinates: [number, number] = [districtData.lng, districtData.lat];
    const currentOfferType = offerTypeRef.current;
    const popupDisplayPrice = currentOfferType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2;
    const tier = getPriceTier(popupDisplayPrice, currentOfferType);
    const tierColor = getTierColor(tier);
    const displayName = districtData.displayName || districtData.name;

    const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
    const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
    const threatLevel = getPriceThreatLevel(popupDisplayPrice, currentOfferType);

    const priceLabel = currentOfferType === 'rent' ? 'AVG RENT/MONTH' : 'AVG PRICE/M²';
    const medianLabel = currentOfferType === 'rent' ? 'MEDIAN RENT' : 'MEDIAN/M²';

    const html = `
      <div style="font-family: ui-monospace, monospace;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid ${tierColor}40;">
          <span style="font-size: 14px; font-weight: 600; color: white;">${displayName.toUpperCase()}</span>
          <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${tierColor}20; color: ${tierColor}; border: 1px solid ${tierColor}40;">${threatLevel.label}</span>
        </div>
        <div style="display: grid; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">${priceLabel}</span>
            <span style="color: ${tierColor}; font-weight: 600;">${formatPrice(popupDisplayPrice)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">${medianLabel}</span>
            <span style="color: white;">${formatPrice(currentOfferType === 'rent' ? (stats.medianPriceM2 * (stats.avgSize || 50)) : stats.medianPriceM2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">30D CHANGE</span>
            <span style="color: ${changeColor};">${changeIcon} ${formatPercent(stats.change30d)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">LISTINGS</span>
            <span style="color: white;">${stats.listingCount}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">AVG SIZE</span>
            <span style="color: white;">${stats.avgSize} m²</span>
          </div>
          ${stats.rentalYield ? `<div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">GROSS YIELD</span>
            <span style="color: ${stats.rentalYield >= 5 ? '#22c55e' : stats.rentalYield >= 4 ? '#eab308' : '#ef4444'}; font-weight: 600;">${stats.rentalYield.toFixed(1)}%</span>
          </div>` : ''}
        </div>
      </div>
    `;

    // Fly to district
    map.current.flyTo({
      center: coordinates,
      zoom: 13,
      duration: 1000,
    });

    // Show popup after fly animation
    setTimeout(() => {
      if (map.current && popup.current) {
        popup.current.setLngLat(coordinates).setHTML(html).addTo(map.current);
      }
    }, 500);

    onDistrictSelect?.(stats);
  }, [focusedDistrict, onDistrictSelect]);

  // Fetch and display listing markers + heatmap when district is selected
  useEffect(() => {
    if (!map.current) return;

    // Clear existing listing markers when district changes
    clearListingMarkers();

    // Remove existing heatmap/price-circles layers and sources
    if (map.current.getLayer('listings-heat')) {
      map.current.removeLayer('listings-heat');
    }
    if (map.current.getSource('listings-data')) {
      map.current.removeSource('listings-data');
    }
    if (map.current.getSource('listings-heat-data')) {
      map.current.removeSource('listings-heat-data');
    }

    if (!focusedDistrict) {
      setListings([]);
      return;
    }

    const citySlug = CITY_API_SLUGS[cityId] || cityId;
    const currentData = cityDataRef.current;
    const districtStats = currentData.DISTRICT_STATS[focusedDistrict];
    const tierColor = districtStats ? getTierColor(getPriceTier(districtStats.avgPriceM2)) : '#00d4aa';

    const fetchListings = async () => {
      try {
        const params = new URLSearchParams({
          city: citySlug,
          district: focusedDistrict,
          offerType,
          limit: '100',
        });
        if (listingFilters?.minPrice) params.set('minPrice', String(listingFilters.minPrice));
        if (listingFilters?.maxPrice) params.set('maxPrice', String(listingFilters.maxPrice));
        if (listingFilters?.minSize) params.set('minSize', String(listingFilters.minSize));
        if (listingFilters?.maxSize) params.set('maxSize', String(listingFilters.maxSize));
        if (listingFilters?.rooms?.length) params.set('rooms', listingFilters.rooms.join(','));

        const response = await fetch(`/api/listings?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const listingsWithCoords = (data.listings || []).filter((l: Listing) => l.lat && l.lng);
        setListings(listingsWithCoords);

        // Play success sound when listings load
        if (listingsWithCoords.length > 0) {
          playSound('success');
        }

        if (map.current && listingsWithCoords.length > 0) {
          const avgPrice = districtStats?.avgPriceM2 || 1;

          if (showListings) {
            addListingMarkers(map.current, listingsWithCoords, avgPrice);
          }

          // Heatmap layer (hidden, kept for future use)
          if (showHeatmap) {
            const expensiveListings = listingsWithCoords.filter((l: Listing) => l.pricePerM2 > avgPrice);
            const heatGeojson = {
              type: 'FeatureCollection' as const,
              features: expensiveListings.map((l: Listing) => {
                const priceRatio = l.pricePerM2 / avgPrice;
                const weight = Math.min(1, Math.max(0.3, (priceRatio - 1) * 2));
                return {
                  type: 'Feature' as const,
                  geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
                  properties: { price: l.pricePerM2, weight, priceRatio }
                };
              })
            };

            // Re-use source if heatmap is on alongside circles
            const heatSourceId = 'listings-heat-data';
            if (map.current.getSource(heatSourceId)) {
              (map.current.getSource(heatSourceId) as maplibregl.GeoJSONSource).setData(heatGeojson);
            } else {
              map.current.addSource(heatSourceId, { type: 'geojson', data: heatGeojson });
            }

            map.current.addLayer({
              id: 'listings-heat',
              type: 'heatmap',
              source: heatSourceId,
              paint: {
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': 1,
                'heatmap-radius': 60,
                'heatmap-opacity': 1,
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'transparent',
                  0.1, tierColor + '30',
                  0.3, tierColor + '60',
                  0.5, tierColor + '90',
                  0.7, tierColor + 'c0',
                  1.0, tierColor + 'ff'
                ]
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch listings for map:', err);
      }
    };

    fetchListings();
  }, [focusedDistrict, cityId, offerType, clearListingMarkers, addListingMarkers, showListings, showHeatmap, listingFilters, playSound]);

  // Toggle district labels visibility
  useEffect(() => {
    markersRef.current.forEach(marker => {
      marker.getElement().style.display = showDistrictLabels ? 'block' : 'none';
    });
  }, [showDistrictLabels]);

  // Toggle listing markers visibility
  useEffect(() => {
    listingMarkersRef.current.forEach(marker => {
      marker.getElement().style.display = showListings ? 'block' : 'none';
    });
  }, [showListings]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!map.current) return;
    if (map.current.getLayer('listings-heat')) {
      map.current.setLayoutProperty('listings-heat', 'visibility', showHeatmap ? 'visible' : 'none');
    }
  }, [showHeatmap]);

  // Toggle district fill visibility (keep borders)
  useEffect(() => {
    if (!map.current) return;
    if (map.current.getLayer('district-fill')) {
      map.current.setPaintProperty('district-fill', 'fill-opacity', showDistrictFill ? [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.35,
        0.15
      ] : 0);
    }
  }, [showDistrictFill]);

  // Apply ignore/favourite visual styles to listing markers
  useEffect(() => {
    Object.entries(listingMarkerElementsRef.current).forEach(([id, el]) => {
      const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
      const pulse = el.querySelector('.listing-marker-pulse') as HTMLElement;
      if (!dot) return;

      const isIgnored = ignoredListings?.has(id);
      const isFavourite = favouriteListings?.has(id);

      if (isIgnored) {
        el.style.filter = 'grayscale(1)';
        dot.style.border = '2px solid #05080a';
        dot.style.boxShadow = '0 0 8px rgba(0,212,170,0.6)';
        dot.style.transform = 'rotate(45deg) scale(1)';
        if (pulse) pulse.style.display = 'none';
      } else if (isFavourite) {
        el.style.filter = 'none';
        dot.style.border = '2px solid #eab308';
        dot.style.boxShadow = '0 0 12px rgba(234,179,8,0.7)';
        dot.style.transform = 'rotate(45deg) scale(1.2)';
        if (pulse) pulse.style.display = 'block';
      } else {
        el.style.filter = 'none';
        dot.style.border = '2px solid #05080a';
        dot.style.boxShadow = '0 0 8px rgba(0,212,170,0.6)';
        dot.style.transform = 'rotate(45deg) scale(1)';
        if (pulse) pulse.style.display = 'block';
      }
    });
  }, [ignoredListings, favouriteListings]);

  // Highlight listing marker on hover from panel
  useEffect(() => {
    // Reset all markers to normal state (respecting ignore/fav)
    Object.entries(listingMarkerElementsRef.current).forEach(([id, el]) => {
      const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
      if (!dot) return;

      const isIgnored = ignoredListings?.has(id);
      const isFavourite = favouriteListings?.has(id);

      if (isIgnored) {
        dot.style.transform = 'rotate(45deg) scale(1)';
        dot.style.boxShadow = '0 0 8px rgba(0,212,170,0.6)';
      } else if (isFavourite) {
        dot.style.transform = 'rotate(45deg) scale(1.2)';
        dot.style.boxShadow = '0 0 12px rgba(234,179,8,0.7)';
      } else {
        dot.style.transform = 'rotate(45deg) scale(1)';
        dot.style.boxShadow = '0 0 8px rgba(0,212,170,0.6)';
      }
      el.style.zIndex = '';
    });

    // Highlight the hovered marker
    if (hoveredListingId && listingMarkerElementsRef.current[hoveredListingId]) {
      const el = listingMarkerElementsRef.current[hoveredListingId];
      const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
      if (dot) {
        dot.style.transform = 'rotate(45deg) scale(1.5)';
        dot.style.boxShadow = '0 0 20px rgba(0,212,170,1)';
      }
      el.style.zIndex = '50';
    }
  }, [hoveredListingId, ignoredListings, favouriteListings]);

  return (
    <div ref={mapContainer} className="map-container map-crosshair w-full h-full isolate" />
  );
}
