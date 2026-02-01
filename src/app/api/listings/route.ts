import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface ListingRow {
  id: string;
  external_id: string;
  city: string;
  district: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price: number;
  size_m2: number;
  price_per_m2: number;
  rooms: number | null;
  url: string;
  title: string | null;
  scraped_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const district = searchParams.get('district');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const rooms = searchParams.get('rooms'); // comma-separated: "1,2,3"

    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from('listings')
      .select('id, external_id, city, district, address, lat, lng, price, size_m2, price_per_m2, rooms, url, title, scraped_at')
      .eq('city', city.toLowerCase())
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(limit);

    // Optional filters
    if (district) {
      query = query.eq('district', district.toLowerCase());
    }

    if (minPrice) {
      query = query.gte('price', parseInt(minPrice, 10));
    }

    if (maxPrice) {
      query = query.lte('price', parseInt(maxPrice, 10));
    }

    if (rooms) {
      const roomsArray = rooms.split(',').map(r => parseInt(r.trim(), 10));
      query = query.in('rooms', roomsArray);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching listings:', error);
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
    }

    // Transform to camelCase
    const listings = (data as ListingRow[] | null)?.map(listing => ({
      id: listing.id,
      externalId: listing.external_id,
      city: listing.city,
      district: listing.district,
      address: listing.address,
      lat: listing.lat,
      lng: listing.lng,
      price: listing.price,
      sizeM2: listing.size_m2,
      pricePerM2: listing.price_per_m2,
      rooms: listing.rooms,
      url: listing.url,
      title: listing.title,
      scrapedAt: listing.scraped_at,
    })) || [];

    return NextResponse.json({
      city,
      district: district || null,
      listings,
      count: listings.length,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
