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
  thumbnail_url: string | null;
  scraped_at: string;
  description: string | null;
  floor: number | null;
  building_year: number | null;
  building_type: string | null;
  heating: string | null;
  finish_condition: string | null;
  photos: string[] | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const district = searchParams.get('district');
    const offerType = searchParams.get('offerType') || 'sale';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'newest'; // newest | price_m2_asc | price_asc
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minSize = searchParams.get('minSize');
    const maxSize = searchParams.get('maxSize');
    const rooms = searchParams.get('rooms'); // comma-separated: "1,2,3"

    if (!city) {
      return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    if (offerType !== 'sale' && offerType !== 'rent') {
      return NextResponse.json({ error: 'Invalid offerType' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from('listings')
      .select('id, external_id, city, district, address, lat, lng, price, size_m2, price_per_m2, rooms, url, title, thumbnail_url, scraped_at, offer_type, description, floor, building_year, building_type, heating, finish_condition, photos')
      .eq('city', city.toLowerCase())
      .eq('offer_type', offerType)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order(
        sortBy === 'price_m2_asc' ? 'price_per_m2' : sortBy === 'price_asc' ? 'price' : 'scraped_at',
        { ascending: sortBy !== 'newest' }
      )
      .limit(limit);

    // Separate count query (same filters, no limit)
    let countQuery = supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('city', city.toLowerCase())
      .eq('offer_type', offerType)
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    // Optional filters — apply to both data and count queries
    if (district) {
      query = query.eq('district', district.toLowerCase());
      countQuery = countQuery.eq('district', district.toLowerCase());
    }

    if (minPrice) {
      query = query.gte('price', parseInt(minPrice, 10));
      countQuery = countQuery.gte('price', parseInt(minPrice, 10));
    }

    if (maxPrice) {
      query = query.lte('price', parseInt(maxPrice, 10));
      countQuery = countQuery.lte('price', parseInt(maxPrice, 10));
    }

    if (minSize) {
      query = query.gte('size_m2', parseInt(minSize, 10));
      countQuery = countQuery.gte('size_m2', parseInt(minSize, 10));
    }

    if (maxSize) {
      query = query.lte('size_m2', parseInt(maxSize, 10));
      countQuery = countQuery.lte('size_m2', parseInt(maxSize, 10));
    }

    if (rooms) {
      const roomsArray = rooms.split(',').map(r => parseInt(r.trim(), 10));
      query = query.in('rooms', roomsArray);
      countQuery = countQuery.in('rooms', roomsArray);
    }

    const [{ data, error }, { count: totalCount }] = await Promise.all([query, countQuery]);

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
      thumbnailUrl: listing.thumbnail_url,
      scrapedAt: listing.scraped_at,
      description: listing.description,
      floor: listing.floor,
      buildingYear: listing.building_year,
      buildingType: listing.building_type,
      heating: listing.heating,
      finishCondition: listing.finish_condition,
      photos: listing.photos,
    })) || [];

    return NextResponse.json({
      city,
      district: district || null,
      listings,
      count: listings.length,
      total: totalCount ?? listings.length,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
