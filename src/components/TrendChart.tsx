'use client';

import { useEffect, useState } from 'react';

interface HistoryPoint {
  date: string;
  avgPriceM2: number;
  medianPriceM2: number;
  listingCount: number;
}

interface TrendChartProps {
  city: string;
  district: string;
  onClose?: () => void;
}

export default function TrendChart({ city, district, onClose }: TrendChartProps) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<{ changePercent: number; changeAbsolute: number } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/cities/${city}/districts/${district}/history?months=6`);
        if (!response.ok) throw new Error('Failed to fetch');

        const json = await response.json();
        setData(json.history || []);
        setTrend(json.trend);
      } catch (err) {
        setError('Failed to load history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [city, district]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-[#00d4aa] font-mono text-xs animate-pulse">LOADING HISTORICAL DATA...</div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500 font-mono text-xs">
          {error || 'NO HISTORICAL DATA AVAILABLE'}
        </div>
        <div className="text-gray-600 font-mono text-[10px] mt-1">
          Data will accumulate over time
        </div>
      </div>
    );
  }

  // Chart dimensions
  const width = 280;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const prices = data.map((d) => d.avgPriceM2);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;
  const priceRange = maxPrice - minPrice || 1;

  // Generate points
  const points = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    const y = padding.top + chartHeight - ((d.avgPriceM2 - minPrice) / priceRange) * chartHeight;
    return { x, y, data: d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Format helpers
  const formatPrice = (price: number) => `${(price / 1000).toFixed(0)}k`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  };

  // Y axis ticks
  const yTicks = [minPrice, (minPrice + maxPrice) / 2, maxPrice];

  const trendColor = trend && trend.changePercent >= 0 ? '#ef4444' : '#22c55e';
  const trendIcon = trend && trend.changePercent >= 0 ? '▲' : '▼';

  return (
    <div className="tactical-panel rounded-lg p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full" />
          <span className="tactical-label">PRICE TREND</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* District name */}
      <div className="mb-2">
        <span className="font-mono text-sm text-white uppercase">{district.replace(/-/g, ' ')}</span>
      </div>

      {/* Trend summary */}
      {trend && (
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-xs text-gray-400">6M CHANGE:</span>
          <span className="font-mono text-sm" style={{ color: trendColor }}>
            {trendIcon} {Math.abs(trend.changePercent).toFixed(1)}%
          </span>
          <span className="font-mono text-xs text-gray-500">
            ({trend.changeAbsolute >= 0 ? '+' : ''}{trend.changeAbsolute.toFixed(0)} zł/m²)
          </span>
        </div>
      )}

      {/* SVG Chart */}
      <svg width={width} height={height} className="overflow-hidden">
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartHeight - ((tick - minPrice) / priceRange) * chartHeight;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(0, 212, 170, 0.1)"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 5}
                y={y + 3}
                textAnchor="end"
                className="fill-gray-500 font-mono"
                fontSize="9"
              >
                {formatPrice(tick)}
              </text>
            </g>
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00d4aa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#00d4aa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#05080a"
            stroke="#00d4aa"
            strokeWidth="1.5"
          />
        ))}

        {/* X axis labels */}
        <text
          x={padding.left}
          y={height - 2}
          textAnchor="start"
          className="fill-gray-500 font-mono"
          fontSize="9"
        >
          {formatDate(data[0].date)}
        </text>
        <text
          x={width - padding.right}
          y={height - 2}
          textAnchor="end"
          className="fill-gray-500 font-mono"
          fontSize="9"
        >
          {formatDate(data[data.length - 1].date)}
        </text>
      </svg>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-[#00d4aa15] flex justify-between">
        <span className="font-mono text-[10px] text-gray-600">{data.length} DATA POINTS</span>
        <span className="font-mono text-[10px] text-gray-600">AVG PRICE/M²</span>
      </div>
    </div>
  );
}
