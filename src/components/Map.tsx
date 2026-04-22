'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITIES, CITY_ORDER } from '@/lib/cities';
import { type DistrictStats, type CityData } from '@/lib/city-data';
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
  description: string | null;
  floor: number | null;
  buildingYear: number | null;
  buildingType: string | null;
  heating: string | null;
  finishCondition: string | null;
  photos: string[] | null;
}

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
  onBoundsChange?: (bbox: [number, number, number, number]) => void;
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
  flyToCity?: string | null;
  onListingClick?: (listing: Listing) => void;
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
  if (ratio <= 0.7) return '#3b82f6';
  if (ratio <= 0.85) return '#06b6d4';
  if (ratio <= 1.0) return '#a3a3a3';
  if (ratio <= 1.15) return '#f59e0b';
  return '#ef4444';
}

// Generate price bar visualization (█░)
function getPriceBars(tier: number): string {
  const filled = tier;
  const empty = 6 - tier;
  return '█'.repeat(filled) + '░'.repeat(empty);
}


export default function Map({ cityId, cityData, offerType = 'sale', onBoundsChange, onDistrictSelect, searchLocation, focusedDistrict, onDistrictClick, showListings = true, showDistrictLabels = true, showHeatmap = true, showDistrictFill = true, listingFilters, hoveredListingId, ignoredListings, favouriteListings, flyToCity, onListingClick }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
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
  const onListingClickRef = useRef(onListingClick);

  // Get current city config
  const cityConfig = CITIES[cityId] || CITIES['warsaw'];
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);

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
    onListingClickRef.current = onListingClick;
  }, [onListingClick]);

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

    // Rent prices (1K–10K) round to unhelpful "1K"/"2K" with plain Math.round;
    // per-m² for rent (40–120 zł) rounds down to "0.1K". Use enough precision
    // so low numbers survive, while keeping high numbers (sales) tidy.
    const fmtCompact = (p: number): string => {
      if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
      if (p >= 100_000)   return `${Math.round(p / 1000)}K`;
      if (p >= 1000)      return `${(p / 1000).toFixed(1)}K`;
      return Math.round(p).toString();
    };

    listingsData.forEach((listing, index) => {
      const priceText = fmtCompact(listing.price);
      const priceM2Text = fmtCompact(listing.pricePerM2);
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
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
          transition: all 0.2s ease;
          transform-origin: center;
        "></div>
        <div class="listing-marker-pulse" style="
          position: absolute;
          top: -12px;
          left: -12px;
          width: 24px;
          height: 24px;
          border: 1px solid rgba(59,130,246,0.4);
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
          border: 1px solid rgba(59,130,246,0.5);
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
          <div style="color: #00d4aa; font-weight: 600;">${priceText} PLN</div>
          <div style="color: rgba(255,255,255,0.6); margin-top: 2px;">${listing.sizeM2}m² · ${priceM2Text}/m²</div>
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
          dot.style.boxShadow = '0 0 15px rgba(59,130,246,0.9)';
        }
      });
      el.addEventListener('mouseleave', () => {
        const tooltip = el.querySelector('.listing-marker-tooltip') as HTMLElement;
        const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
        if (tooltip) tooltip.style.opacity = '0';
        if (dot) {
          dot.style.transform = 'rotate(45deg) scale(1)';
          dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
        }
      });

      // Click opens listing detail panel (or falls back to URL)
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('ping');
        if (onListingClickRef.current) {
          onListingClickRef.current(listing);
        } else {
          const a = document.createElement('a');
          a.href = listing.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
        }
      });

      const currentZoom = mapInstance.getZoom();
      el.style.display = (showListingsRef.current && currentZoom >= 10.5) ? 'block' : 'none';

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
          <div class="marker-price" style="color: ${color};">${(displayPrice / 1000).toFixed(1)}k</div>
          <div class="marker-detail">
            <div class="marker-bars" style="color: ${color};">${bars}</div>
            ${rangeHtml}
            <div class="marker-meta">
              <span class="marker-listings">${stats.listingCount}</span>
              <span class="marker-change" style="color: ${changeColor};">${changeIcon}${Math.abs(stats.change30d).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      `;

      const zoom = mapInstance.getZoom();
      const visible = showDistrictLabelsRef.current && zoom >= 9;
      el.style.display = visible ? 'block' : 'none';
      if (zoom < 10.5) el.classList.add('district-marker--compact');

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
        const hasData = !!(stats && stats.avgPriceM2 > 0);
        const displayPrice = stats ? (offerType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2) : 0;
        const tier = hasData ? getPriceTier(displayPrice, offerType) : 0;
        return {
          type: 'Feature' as const,
          id: feature.id,
          geometry: feature.geometry,
          properties: {
            ...feature.properties,
            priceTier: tier,
            hasData,
            color: hasData ? getTierColor(tier) : '#666',
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
  }, [addMarkers, offerType]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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
      minZoom: 9,
      maxZoom: 16,
      maxBounds: [
        [13.5, 48.5], // SW corner of Poland (with padding)
        [24.5, 55.5], // NE corner of Poland (with padding)
      ],
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Fire bounds on moveend
    const fireBounds = () => {
      if (!map.current) return;
      const bounds = map.current.getBounds();
      onBoundsChangeRef.current?.([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ]);
    };
    map.current.on('moveend', fireBounds);

    // Hide district markers when zoomed out too far
    const DISTRICT_LABEL_MIN_ZOOM = 9;
    const DISTRICT_DETAIL_ZOOM = 10.5;
    const updateMarkerVisibility = () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      const visible = zoom >= DISTRICT_LABEL_MIN_ZOOM && showDistrictLabelsRef.current;
      const compact = zoom < DISTRICT_DETAIL_ZOOM;
      markersRef.current.forEach(marker => {
        const el = marker.getElement();
        el.style.display = visible ? 'block' : 'none';
        el.classList.toggle('district-marker--compact', compact);
      });
      const listingsVisible = zoom >= DISTRICT_DETAIL_ZOOM && showListingsRef.current;
      listingMarkersRef.current.forEach(marker => {
        marker.getElement().style.display = listingsVisible ? 'block' : 'none';
      });
    };
    map.current.on('zoom', updateMarkerVisibility);

    map.current.on('load', () => {
      if (!map.current) return;

      // Fire initial bounds
      fireBounds();

      // === City boundary outlines (instant, no API needed) ===
      const cityBoundaryFeatures = CITY_ORDER.map((id) => {
        const c = CITIES[id];
        const [[swLng, swLat], [neLng, neLat]] = c.bounds;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [swLng, swLat],
              [neLng, swLat],
              [neLng, neLat],
              [swLng, neLat],
              [swLng, swLat],
            ]],
          },
          properties: { name: c.name, id: c.id },
        };
      });

      const cityLabelFeatures = CITY_ORDER.map((id) => {
        const c = CITIES[id];
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: c.center,
          },
          properties: { name: c.name },
        };
      });

      map.current.addSource('city-boundaries', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: cityBoundaryFeatures } as GeoJSON.FeatureCollection,
      });

      map.current.addSource('city-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: cityLabelFeatures } as GeoJSON.FeatureCollection,
      });

      // Dashed border for each city
      map.current.addLayer({
        id: 'city-boundary-line',
        type: 'line',
        source: 'city-boundaries',
        paint: {
          'line-color': '#00d4aa',
          'line-width': 1,
          'line-opacity': 0.3,
          'line-dasharray': [4, 4],
        },
      });

      // Subtle fill so cities are visible when zoomed out
      map.current.addLayer({
        id: 'city-boundary-fill',
        type: 'fill',
        source: 'city-boundaries',
        paint: {
          'fill-color': '#00d4aa',
          'fill-opacity': 0.03,
        },
      });

      // City name labels
      map.current.addLayer({
        id: 'city-labels',
        type: 'symbol',
        source: 'city-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 14,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.15,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#00d4aa',
          'text-opacity': 0.5,
          'text-halo-color': '#05080a',
          'text-halo-width': 2,
        },
      });

      // Prepare initial GeoJSON
      const geoJSONWithPrices = {
        type: 'FeatureCollection' as const,
        features: cityData.DISTRICTS_GEOJSON.features.map((feature) => {
          const stats = cityData.DISTRICT_STATS[feature.properties.name];
          const hasData = !!(stats && stats.avgPriceM2 > 0);
          const displayPrice = stats ? (offerType === 'rent' ? (stats.avgPrice || 0) : stats.avgPriceM2) : 0;
          const tier = hasData ? getPriceTier(displayPrice, offerType) : 0;
          return {
            type: 'Feature' as const,
            id: feature.id,
            geometry: feature.geometry,
            properties: {
              ...feature.properties,
              priceTier: tier,
              hasData,
              color: hasData ? getTierColor(tier) : '#666',
            },
          };
        }),
      };

      map.current.addSource('districts', {
        type: 'geojson',
        data: geoJSONWithPrices as GeoJSON.FeatureCollection,
      });

      // District fill - subtle tint for districts without data
      map.current.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': showDistrictFill ? [
            'case',
            ['!', ['get', 'hasData']],
            0.06,
            ['boolean', ['feature-state', 'hover'], false],
            0.35,
            0.15
          ] : 0,
        },
      });

      // District borders - neutral for districts without data
      map.current.addLayer({
        id: 'district-borders',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['!', ['get', 'hasData']],
            0.8,
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1
          ],
          'line-opacity': [
            'case',
            ['!', ['get', 'hasData']],
            0.5,
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

        map.current.getCanvas().style.cursor = 'inherit';

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

      // Click handler — right panel handles the details, just trigger selection
      map.current.on('click', 'district-fill', (e) => {
        if (!map.current || !e.features?.[0]) return;
        playSoundRef.current('pop');

        const name = e.features[0].properties?.name;
        const districtData = cityDataRef.current.DISTRICT_CENTERS.find(d => d.name === name);
        if (!districtData) return;

        onDistrictSelect?.(districtData.stats);
        onDistrictClickRef.current?.(name);
      });
    });

    return () => {
      clearMarkers();
      clearListingMarkers();
      if (map.current) map.current.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle data change (viewport districts updated)
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    currentCityRef.current = cityId;

    // Update district polygons and markers with new viewport data
    updateMapData(map.current, cityData);
  }, [cityId, cityData, updateMapData]);

  // Handle flyToCity
  useEffect(() => {
    if (!map.current || !flyToCity) return;
    const config = CITIES[flyToCity];
    if (!config) return;

    map.current.flyTo({
      center: config.center,
      zoom: config.zoom,
      duration: 1500,
    });
  }, [flyToCity]);

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

  // Handle focused district from panel click — fly to it, details shown in right panel
  useEffect(() => {
    if (!map.current || !focusedDistrict) return;

    const districtData = cityDataRef.current.DISTRICT_CENTERS.find(d => d.name === focusedDistrict);
    if (!districtData) return;

    map.current.flyTo({
      center: [districtData.lng, districtData.lat],
      zoom: 13,
      duration: 1000,
    });

    onDistrictSelect?.(districtData.stats);
  }, [focusedDistrict, onDistrictSelect]);

  // Fetch listings into state when district/offerType/filters change.
  // Rendering onto the map is handled by the next effect so that marker colors
  // re-update when the district's avgPriceM2 arrives from useViewportDistricts
  // (that fetch is debounced 300ms — before it completes, cityData still holds
  // the previous offerType's avg, which would tint every rent listing blue).
  useEffect(() => {
    if (!focusedDistrict) {
      setListings([]);
      return;
    }

    const citySlug = CITY_API_SLUGS[cityId] || cityId;
    let cancelled = false;

    // Clear previous listings immediately so the render effect doesn't mix
    // stale sale listings with new rent stats (or vice-versa) while the
    // new fetch is in flight.
    setListings([]);

    const run = async () => {
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
        if (cancelled) return;

        const listingsWithCoords = (data.listings || []).filter((l: Listing) => l.lat && l.lng);
        setListings(listingsWithCoords);
        if (listingsWithCoords.length > 0) playSound('success');
      } catch (err) {
        if (!cancelled) console.error('Failed to fetch listings for map:', err);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [focusedDistrict, cityId, offerType, listingFilters, playSound]);

  // Render listing markers + heatmap. Depends on both `listings` (data) and
  // the focused district's avgPriceM2 from cityData, so that after the 300ms
  // viewport-stats refetch completes with new-offerType averages, markers
  // re-tint using the correct ratio.
  const focusedDistrictStats = focusedDistrict
    ? cityData.DISTRICT_STATS[focusedDistrict]
    : undefined;
  const focusedAvgPriceM2 = focusedDistrictStats?.avgPriceM2;
  const focusedStatsOfferType = focusedDistrictStats?.offerType;

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    // Always start clean — avoids duplicate markers and stale heatmap layers.
    clearListingMarkers();
    if (mapInstance.getLayer('listings-heat')) mapInstance.removeLayer('listings-heat');
    if (mapInstance.getSource('listings-data')) mapInstance.removeSource('listings-data');
    if (mapInstance.getSource('listings-heat-data')) mapInstance.removeSource('listings-heat-data');

    if (!focusedDistrict || listings.length === 0 || !focusedAvgPriceM2) return;

    // Guard: if the stats we have are for a different offerType than the
    // listings we just fetched, skip rendering until fresh stats arrive.
    // Otherwise we'd tint all rent listings as "below average" using the
    // much-higher sale average (or vice versa).
    if (focusedStatsOfferType && focusedStatsOfferType !== offerType) return;

    const tierColor = getTierColor(getPriceTier(focusedAvgPriceM2, offerType));

    if (showListings) {
      addListingMarkers(mapInstance, listings, focusedAvgPriceM2);
    }

    if (showHeatmap) {
      const expensiveListings = listings.filter((l) => l.pricePerM2 > focusedAvgPriceM2);
      const heatGeojson = {
        type: 'FeatureCollection' as const,
        features: expensiveListings.map((l) => {
          const priceRatio = l.pricePerM2 / focusedAvgPriceM2;
          const weight = Math.min(1, Math.max(0.3, (priceRatio - 1) * 2));
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
            properties: { price: l.pricePerM2, weight, priceRatio },
          };
        }),
      };

      const heatSourceId = 'listings-heat-data';
      if (mapInstance.getSource(heatSourceId)) {
        (mapInstance.getSource(heatSourceId) as maplibregl.GeoJSONSource).setData(heatGeojson);
      } else {
        mapInstance.addSource(heatSourceId, { type: 'geojson', data: heatGeojson });
      }

      mapInstance.addLayer({
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
            1.0, tierColor + 'ff',
          ],
        },
      });
    }
  }, [
    listings,
    focusedDistrict,
    focusedAvgPriceM2,
    focusedStatsOfferType,
    offerType,
    showListings,
    showHeatmap,
    clearListingMarkers,
    addListingMarkers,
  ]);

  // Toggle district labels visibility (respects zoom)
  useEffect(() => {
    const zoom = map.current?.getZoom() ?? 11;
    const visible = showDistrictLabels && zoom >= 9;
    const compact = zoom < 10.5;
    markersRef.current.forEach(marker => {
      const el = marker.getElement();
      el.style.display = visible ? 'block' : 'none';
      el.classList.toggle('district-marker--compact', compact);
    });
  }, [showDistrictLabels]);

  // Toggle listing markers visibility (respects zoom)
  useEffect(() => {
    const zoom = map.current?.getZoom() ?? 11;
    const visible = showListings && zoom >= 10.5;
    listingMarkersRef.current.forEach(marker => {
      marker.getElement().style.display = visible ? 'block' : 'none';
    });
  }, [showListings]);

  // Toggle heatmap visibility
  useEffect(() => {
    if (!map.current) return;
    if (map.current.getLayer('listings-heat')) {
      map.current.setLayoutProperty('listings-heat', 'visibility', showHeatmap ? 'visible' : 'none');
    }
  }, [showHeatmap]);

  // Toggle district fill visibility (keep borders, no fill for no-data districts)
  useEffect(() => {
    if (!map.current) return;
    if (map.current.getLayer('district-fill')) {
      map.current.setPaintProperty('district-fill', 'fill-opacity', showDistrictFill ? [
        'case',
        ['!', ['get', 'hasData']],
        0,
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
        dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
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
        dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
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
        dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
      } else if (isFavourite) {
        dot.style.transform = 'rotate(45deg) scale(1.2)';
        dot.style.boxShadow = '0 0 12px rgba(234,179,8,0.7)';
      } else {
        dot.style.transform = 'rotate(45deg) scale(1)';
        dot.style.boxShadow = '0 0 8px rgba(59,130,246,0.6)';
      }
      el.style.zIndex = '';
    });

    // Highlight the hovered marker
    if (hoveredListingId && listingMarkerElementsRef.current[hoveredListingId]) {
      const el = listingMarkerElementsRef.current[hoveredListingId];
      const dot = el.querySelector('.listing-marker-dot') as HTMLElement;
      if (dot) {
        dot.style.transform = 'rotate(45deg) scale(1.5)';
        dot.style.boxShadow = '0 0 20px rgba(59,130,246,1)';
      }
      el.style.zIndex = '50';
    }
  }, [hoveredListingId, ignoredListings, favouriteListings]);

  return (
    <div ref={mapContainer} className="map-container map-crosshair w-full h-full isolate" />
  );
}
