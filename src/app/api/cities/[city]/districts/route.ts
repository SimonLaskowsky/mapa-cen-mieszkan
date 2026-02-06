import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { LatestDistrictStats, DistrictPriceChange, District } from '@/types/database';

interface RouteParams {
  params: Promise<{ city: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { city } = await params;
    const { searchParams } = new URL(request.url);
    const offerType = searchParams.get('offerType') || 'sale';

    if (offerType !== 'sale' && offerType !== 'rent') {
      return NextResponse.json({ error: 'Invalid offerType' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch latest stats for all districts in the city
    const { data: stats, error: statsError } = await supabase
      .from('latest_district_stats')
      .select('*')
      .eq('city', city.toLowerCase())
      .eq('offer_type', offerType)
      .returns<LatestDistrictStats[]>();

    if (statsError) {
      console.error('Error fetching district stats:', statsError);
      return NextResponse.json({ error: 'Failed to fetch district stats' }, { status: 500 });
    }

    // Fetch price changes
    const { data: changes, error: changesError } = await supabase
      .from('district_price_changes')
      .select('*')
      .eq('city', city.toLowerCase())
      .eq('offer_type', offerType)
      .returns<DistrictPriceChange[]>();

    if (changesError) {
      console.error('Error fetching price changes:', changesError);
    }

    // Fetch district geo data
    const { data: districts, error: districtError } = await supabase
      .from('districts')
      .select('district, center_lat, center_lng, geojson')
      .eq('city', city.toLowerCase())
      .returns<Pick<District, 'district' | 'center_lat' | 'center_lng' | 'geojson'>[]>();

    if (districtError) {
      console.error('Error fetching districts:', districtError);
    }

    // Merge data
    const result = stats?.map((stat) => {
      const change = changes?.find((c) => c.district === stat.district);
      const district = districts?.find((d) => d.district === stat.district);

      return {
        district: stat.district,
        offerType: stat.offer_type,
        date: stat.date,
        avgPrice: stat.avg_price,
        avgPriceM2: stat.avg_price_m2,
        medianPriceM2: stat.median_price_m2,
        minPriceM2: stat.min_price_m2,
        maxPriceM2: stat.max_price_m2,
        listingCount: stat.listing_count,
        newListings: stat.new_listings,
        avgSizeM2: stat.avg_size_m2,
        change30d: change?.change_percent_30d || null,
        rooms: {
          '1': stat.count_1room,
          '2': stat.count_2room,
          '3': stat.count_3room,
          '4+': stat.count_4plus,
        },
        center: district
          ? {
              lat: district.center_lat,
              lng: district.center_lng,
            }
          : null,
      };
    });

    return NextResponse.json({
      city,
      districts: result || [],
      updatedAt: stats?.[0]?.date || null,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
