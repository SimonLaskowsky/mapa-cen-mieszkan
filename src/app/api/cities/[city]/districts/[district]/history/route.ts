import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { DistrictStats } from '@/types/database';

interface RouteParams {
  params: Promise<{ city: string; district: string }>;
}

type HistoryRow = Pick<
  DistrictStats,
  'date' | 'avg_price_m2' | 'median_price_m2' | 'listing_count' | 'new_listings'
>;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { city, district } = await params;
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12', 10);

    const supabase = createServerClient();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('district_stats')
      .select('date, avg_price_m2, median_price_m2, listing_count, new_listings')
      .eq('city', city.toLowerCase())
      .eq('district', decodeURIComponent(district).toLowerCase())
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .returns<HistoryRow[]>();

    if (error) {
      console.error('Error fetching history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Transform data for charts
    const history = data?.map((d) => ({
      date: d.date,
      avgPriceM2: d.avg_price_m2,
      medianPriceM2: d.median_price_m2,
      listingCount: d.listing_count,
      newListings: d.new_listings,
    }));

    // Calculate trends
    const firstPrice = history?.[0]?.avgPriceM2;
    const lastPrice = history?.[history.length - 1]?.avgPriceM2;
    const changePercent =
      firstPrice && lastPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : null;

    return NextResponse.json({
      city,
      district: decodeURIComponent(district),
      months,
      history: history || [],
      summary: {
        startPrice: firstPrice,
        endPrice: lastPrice,
        changePercent: changePercent ? Math.round(changePercent * 100) / 100 : null,
        dataPoints: history?.length || 0,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
