import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { DistrictStats, LatestDistrictStats } from '@/types/database';

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get unique cities with their latest stats
    const { data, error } = await supabase
      .from('district_stats')
      .select('city')
      .order('city')
      .returns<Pick<DistrictStats, 'city'>[]>();

    if (error) {
      console.error('Error fetching cities:', error);
      return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
    }

    // Get unique cities
    const cities = [...new Set(data?.map((d) => d.city) || [])];

    // Get stats for each city
    const cityStats = await Promise.all(
      cities.map(async (city) => {
        const { data: stats } = await supabase
          .from('latest_district_stats')
          .select('avg_price_m2, listing_count')
          .eq('city', city)
          .returns<Pick<LatestDistrictStats, 'avg_price_m2' | 'listing_count'>[]>();

        const totalListings = stats?.reduce((sum, s) => sum + (s.listing_count || 0), 0) || 0;
        const avgPrice =
          stats && stats.length > 0
            ? stats.reduce((sum, s) => sum + (s.avg_price_m2 || 0), 0) / stats.length
            : null;

        return {
          slug: city,
          name: city.charAt(0).toUpperCase() + city.slice(1),
          districtCount: stats?.length || 0,
          totalListings,
          avgPriceM2: avgPrice ? Math.round(avgPrice) : null,
        };
      })
    );

    return NextResponse.json(cityStats);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
