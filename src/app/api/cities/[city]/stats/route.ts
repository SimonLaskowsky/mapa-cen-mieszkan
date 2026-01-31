import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { LatestDistrictStats, DistrictPriceChange } from '@/types/database';

interface RouteParams {
  params: Promise<{ city: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { city } = await params;
    const supabase = createServerClient();

    // Fetch latest stats for all districts
    const { data: stats, error } = await supabase
      .from('latest_district_stats')
      .select('*')
      .eq('city', city.toLowerCase())
      .returns<LatestDistrictStats[]>();

    if (error) {
      console.error('Error fetching city stats:', error);
      return NextResponse.json({ error: 'Failed to fetch city stats' }, { status: 500 });
    }

    if (!stats || stats.length === 0) {
      return NextResponse.json({ error: 'City not found' }, { status: 404 });
    }

    // Fetch price changes
    const { data: changes } = await supabase
      .from('district_price_changes')
      .select('*')
      .eq('city', city.toLowerCase())
      .returns<DistrictPriceChange[]>();

    // Calculate city-wide statistics
    const totalListings = stats.reduce((sum, s) => sum + (s.listing_count || 0), 0);
    const totalNewListings = stats.reduce((sum, s) => sum + (s.new_listings || 0), 0);

    const prices = stats
      .map((s) => s.avg_price_m2)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);

    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

    const medianPrice =
      prices.length > 0
        ? prices.length % 2 === 0
          ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
          : prices[Math.floor(prices.length / 2)]
        : null;

    // Calculate weighted average change
    const validChanges =
      changes?.filter((c) => c.change_percent_30d !== null && c.current_price !== null) || [];
    const avgChange =
      validChanges.length > 0
        ? validChanges.reduce((sum, c) => sum + (c.change_percent_30d || 0), 0) /
          validChanges.length
        : null;

    // Find extremes
    const sortedByPrice = [...stats].sort(
      (a, b) => (b.avg_price_m2 || 0) - (a.avg_price_m2 || 0)
    );

    return NextResponse.json({
      city,
      districtCount: stats.length,
      totalListings,
      totalNewListings,
      avgPriceM2: avgPrice ? Math.round(avgPrice) : null,
      medianPriceM2: medianPrice ? Math.round(medianPrice) : null,
      minPriceM2: prices.length > 0 ? Math.round(prices[0]) : null,
      maxPriceM2: prices.length > 0 ? Math.round(prices[prices.length - 1]) : null,
      change30d: avgChange ? Math.round(avgChange * 100) / 100 : null,
      mostExpensive: sortedByPrice[0]
        ? {
            district: sortedByPrice[0].district,
            avgPriceM2: sortedByPrice[0].avg_price_m2,
          }
        : null,
      cheapest: sortedByPrice[sortedByPrice.length - 1]
        ? {
            district: sortedByPrice[sortedByPrice.length - 1].district,
            avgPriceM2: sortedByPrice[sortedByPrice.length - 1].avg_price_m2,
          }
        : null,
      updatedAt: stats[0]?.date || null,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
