'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITIES, findCityAtPoint } from '@/lib/cities';
import { formatPrice, formatPercent, type DistrictStats, type CityData } from '@/lib/city-data';

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
};

interface SearchLocation {
  lat: number;
  lng: number;
  displayName: string;
}

interface MapProps {
  cityId: string;
  cityData: CityData;
  onCityChange?: (cityId: string) => void;
  onDistrictSelect?: (district: DistrictStats | null) => void;
  searchLocation?: SearchLocation | null;
  focusedDistrict?: string | null;
  onDistrictClick?: (district: string | null) => void;
  showListings?: boolean;
  showDistrictLabels?: boolean;
  showHeatmap?: boolean;
}

// Get price tier (1-6) for color coding
function getPriceTier(price: number): number {
  if (price < 12000) return 1;
  if (price < 14000) return 2;
  if (price < 16000) return 3;
  if (price < 18000) return 4;
  if (price < 22000) return 5;
  return 6;
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

// Generate price bar visualization (█░)
function getPriceBars(tier: number): string {
  const filled = tier;
  const empty = 6 - tier;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getPriceThreatLevel(price: number): { label: string; color: string } {
  if (price < 12000) return { label: 'LOW', color: '#22c55e' };
  if (price < 14000) return { label: 'MODERATE', color: '#84cc16' };
  if (price < 16000) return { label: 'ELEVATED', color: '#eab308' };
  if (price < 18000) return { label: 'HIGH', color: '#f97316' };
  if (price < 22000) return { label: 'SEVERE', color: '#ef4444' };
  return { label: 'CRITICAL', color: '#dc2626' };
}

export default function Map({ cityId, cityData, onCityChange, onDistrictSelect, searchLocation, focusedDistrict, onDistrictClick, showListings = true, showDistrictLabels = true, showHeatmap = true }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const listingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const currentCityRef = useRef(cityId);
  const cityDataRef = useRef(cityData);
  const onDistrictClickRef = useRef(onDistrictClick);
  const [listings, setListings] = useState<Listing[]>([]);

  // Get current city config
  const cityConfig = CITIES[cityId];

  // Keep refs updated
  useEffect(() => {
    cityDataRef.current = cityData;
  }, [cityData]);

  useEffect(() => {
    onDistrictClickRef.current = onDistrictClick;
  }, [onDistrictClick]);

  // Remove existing markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  // Remove listing markers
  const clearListingMarkers = useCallback(() => {
    listingMarkersRef.current.forEach(marker => marker.remove());
    listingMarkersRef.current = [];
  }, []);

  // Add listing markers to map
  const addListingMarkers = useCallback((mapInstance: maplibregl.Map, listingsData: Listing[]) => {
    clearListingMarkers();

    listingsData.forEach((listing, index) => {
      const priceK = Math.round(listing.price / 1000);
      const priceM2K = (listing.pricePerM2 / 1000).toFixed(1);

      const el = document.createElement('div');
      el.className = 'listing-marker';
      el.style.cssText = `
        width: 0;
        height: 0;
        cursor: pointer;
        z-index: ${100 + index};
      `;
      el.innerHTML = `
        <div class="listing-marker-dot" style="
          position: absolute;
          top: -7px;
          left: -7px;
          width: 10px;
          height: 10px;
          background: #00d4aa;
          border: 2px solid #05080a;
          transform: rotate(45deg);
          box-shadow: 0 0 8px rgba(0,212,170,0.6);
          transition: all 0.2s ease;
          transform-origin: center;
        "></div>
        <div class="listing-marker-pulse" style="
          position: absolute;
          top: -14px;
          left: -14px;
          width: 24px;
          height: 24px;
          border: 1px solid rgba(0,212,170,0.4);
          border-radius: 50%;
          animation: listing-pulse 2s ease-out infinite;
          animation-delay: ${index * 0.1}s;
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
          padding: 6px 10px;
          font-family: ui-monospace, monospace;
          font-size: 10px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        ">
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

      // Click opens listing URL
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(listing.url, '_blank');
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([listing.lng, listing.lat])
        .addTo(mapInstance);

      listingMarkersRef.current.push(marker);
    });
  }, [clearListingMarkers]);

  // Add markers for districts
  const addMarkers = useCallback((mapInstance: maplibregl.Map, data: typeof cityData) => {
    clearMarkers();

    data.DISTRICT_CENTERS.forEach((district) => {
      const stats = district.stats;
      const tier = getPriceTier(stats.avgPriceM2);
      const color = getTierColor(tier);
      const bars = getPriceBars(tier);
      const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
      const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
      const displayName = district.displayName || district.name;

      const el = document.createElement('div');
      el.className = 'district-marker';
      el.innerHTML = `
        <div class="district-marker-content" style="--tier-color: ${color};">
          <div class="marker-name">${displayName}</div>
          <div class="marker-bars" style="color: ${color};">${bars}</div>
          <div class="marker-price">${(stats.avgPriceM2 / 1000).toFixed(1)}k</div>
          <div class="marker-meta">
            <span class="marker-listings">${stats.listingCount}</span>
            <span class="marker-change" style="color: ${changeColor};">${changeIcon}${Math.abs(stats.change30d).toFixed(1)}%</span>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([district.lng, district.lat])
        .addTo(mapInstance);

      markersRef.current.push(marker);
    });
  }, [clearMarkers]);

  // Update map layers with new city data
  const updateMapData = useCallback((mapInstance: maplibregl.Map, data: typeof cityData) => {
    // Prepare GeoJSON with price colors
    const geoJSONWithPrices = {
      type: 'FeatureCollection' as const,
      features: data.DISTRICTS_GEOJSON.features.map((feature) => {
        const stats = data.DISTRICT_STATS[feature.properties.name];
        const tier = stats ? getPriceTier(stats.avgPriceM2) : 3;
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
          const tier = stats ? getPriceTier(stats.avgPriceM2) : 3;
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
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.35,
            0.15
          ],
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

        if (hoveredId !== null) {
          map.current.setFeatureState(
            { source: 'districts', id: hoveredId },
            { hover: false }
          );
        }

        hoveredId = e.features[0].id ?? null;
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

        const feature = e.features[0];
        const name = feature.properties?.name;
        const currentData = cityDataRef.current;
        const districtData = currentData.DISTRICT_CENTERS.find(d => d.name === name);

        if (!districtData) return;

        const stats = districtData.stats;
        const coordinates = e.lngLat;
        const tier = getPriceTier(stats.avgPriceM2);
        const tierColor = getTierColor(tier);
        const displayName = districtData.displayName || districtData.name;

        const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
        const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
        const threatLevel = getPriceThreatLevel(stats.avgPriceM2);

        const html = `
          <div style="font-family: ui-monospace, monospace;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid ${tierColor}40;">
              <span style="font-size: 14px; font-weight: 600; color: white;">${displayName.toUpperCase()}</span>
              <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${tierColor}20; color: ${tierColor}; border: 1px solid ${tierColor}40;">${threatLevel.label}</span>
            </div>
            <div style="display: grid; gap: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">AVG PRICE/M²</span>
                <span style="color: ${tierColor}; font-weight: 600;">${formatPrice(stats.avgPriceM2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 4px;">
                <span style="color: rgba(255,255,255,0.5);">MEDIAN</span>
                <span style="color: white;">${formatPrice(stats.medianPriceM2)}</span>
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
    const tier = getPriceTier(stats.avgPriceM2);
    const tierColor = getTierColor(tier);
    const displayName = districtData.displayName || districtData.name;

    const changeColor = stats.change30d >= 0 ? '#ef4444' : '#22c55e';
    const changeIcon = stats.change30d >= 0 ? '▲' : '▼';
    const threatLevel = getPriceThreatLevel(stats.avgPriceM2);

    const html = `
      <div style="font-family: ui-monospace, monospace;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid ${tierColor}40;">
          <span style="font-size: 14px; font-weight: 600; color: white;">${displayName.toUpperCase()}</span>
          <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${tierColor}20; color: ${tierColor}; border: 1px solid ${tierColor}40;">${threatLevel.label}</span>
        </div>
        <div style="display: grid; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">AVG PRICE/M²</span>
            <span style="color: ${tierColor}; font-weight: 600;">${formatPrice(stats.avgPriceM2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 4px;">
            <span style="color: rgba(255,255,255,0.5);">MEDIAN</span>
            <span style="color: white;">${formatPrice(stats.medianPriceM2)}</span>
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

    // Remove existing heatmap layer and source
    if (map.current.getLayer('listings-heat')) {
      map.current.removeLayer('listings-heat');
    }
    if (map.current.getSource('listings-data')) {
      map.current.removeSource('listings-data');
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
        const response = await fetch(`/api/listings?city=${citySlug}&district=${focusedDistrict}&limit=100`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const listingsWithCoords = (data.listings || []).filter((l: Listing) => l.lat && l.lng);
        setListings(listingsWithCoords);

        if (map.current && listingsWithCoords.length > 0) {
          if (showListings) {
            addListingMarkers(map.current, listingsWithCoords);
          }

          if (showHeatmap) {
            // Add heatmap layer for expensive listings only
            const avgPrice = districtStats?.avgPriceM2 || 15000;
            const expensiveListings = listingsWithCoords.filter((l: Listing) => l.pricePerM2 > avgPrice);

            const geojson = {
              type: 'FeatureCollection' as const,
              features: expensiveListings.map((l: Listing) => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
                properties: {
                  price: l.pricePerM2,
                  weight: Math.min(1, l.pricePerM2 / avgPrice)
                }
              }))
            };

            map.current.addSource('listings-data', { type: 'geojson', data: geojson });

            map.current.addLayer({
              id: 'listings-heat',
              type: 'heatmap',
              source: 'listings-data',
              paint: {
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': 1,
                'heatmap-radius': 60,
                'heatmap-opacity': 1,
                'heatmap-color': [
                  'step', ['heatmap-density'],
                  'transparent',
                  0.15, tierColor + '90'
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
  }, [focusedDistrict, cityId, clearListingMarkers, addListingMarkers, showListings, showHeatmap]);

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

  return (
    <div ref={mapContainer} className="map-container w-full h-full" />
  );
}
