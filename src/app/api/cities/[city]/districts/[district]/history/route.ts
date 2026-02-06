import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ city: string; district: string }>;
}

interface DistrictStatsRow {
  date: string;
  avg_price: number | null;
  avg_price_m2: number | null;
  median_price_m2: number | null;
  listing_count: number | null;
  offer_type: string;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { city, district } = await params;
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '6', 10);
    const offerType = searchParams.get('offerType') || 'sale';

    if (offerType !== 'sale' && offerType !== 'rent') {
      return NextResponse.json({ error: 'Invalid offerType' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('district_stats')
      .select('date, avg_price, avg_price_m2, median_price_m2, listing_count, offer_type')
      .eq('city', city.toLowerCase())
      .eq('district', district.toLowerCase())
      .eq('offer_type', offerType)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    // Transform data for chart
    const history = (data as DistrictStatsRow[] | null)?.map((row) => ({
      date: row.date,
      avgPrice: row.avg_price,
      avgPriceM2: row.avg_price_m2,
      medianPriceM2: row.median_price_m2,
      listingCount: row.listing_count,
      offerType: row.offer_type,
    })) || [];

    // Calculate trend (compare first and last data points)
    let trend = null;
    if (history.length >= 2) {
      const first = history[0].avgPriceM2;
      const last = history[history.length - 1].avgPriceM2;
      if (first && last) {
        trend = {
          changePercent: ((last - first) / first) * 100,
          changeAbsolute: last - first,
        };
      }
    }

    return NextResponse.json({
      city,
      district,
      history,
      trend,
      dataPoints: history.length,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
