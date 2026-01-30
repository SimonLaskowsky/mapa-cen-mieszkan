'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CITIES, findCityAtPoint } from '@/lib/cities';
import { CITY_DATA, formatPrice, formatPercent, type DistrictStats } from '@/lib/city-data';

interface MapProps {
  cityId: string;
  onCityChange?: (cityId: string) => void;
  onDistrictSelect?: (district: DistrictStats | null) => void;
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

export default function Map({ cityId, onCityChange, onDistrictSelect }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const currentCityRef = useRef(cityId);

  // Get current city config and data
  const cityConfig = CITIES[cityId];
  const cityData = CITY_DATA[cityId];

  // Remove existing markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

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
        const currentData = CITY_DATA[currentCityRef.current];
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
      });
    });

    return () => {
      clearMarkers();
      if (popup.current) popup.current.remove();
      if (map.current) map.current.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle city change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    currentCityRef.current = cityId;
    const config = CITIES[cityId];
    const data = CITY_DATA[cityId];

    // Fly to new city
    map.current.flyTo({
      center: config.center,
      zoom: config.zoom,
      duration: 1500,
    });

    // Update data
    updateMapData(map.current, data);

    // Close any open popup
    if (popup.current) popup.current.remove();
  }, [cityId, updateMapData]);

  return (
    <div ref={mapContainer} className="map-container w-full h-full" />
  );
}
