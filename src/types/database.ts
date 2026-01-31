// Auto-generated types for Supabase database
// These types match the schema in supabase/migrations/001_initial_schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      districts: {
        Row: {
          id: string;
          city: string;
          district: string;
          geojson: Json;
          center_lat: number;
          center_lng: number;
          population: number | null;
          area_km2: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          district: string;
          geojson: Json;
          center_lat: number;
          center_lng: number;
          population?: number | null;
          area_km2?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          district?: string;
          geojson?: Json;
          center_lat?: number;
          center_lng?: number;
          population?: number | null;
          area_km2?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      listings: {
        Row: {
          id: string;
          external_id: string | null;
          source: 'otodom' | 'olx' | 'morizon';
          city: string;
          district: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          price: number;
          size_m2: number;
          rooms: number | null;
          price_per_m2: number;
          offer_type: 'sale' | 'rent';
          url: string;
          title: string | null;
          scraped_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_id?: string | null;
          source: 'otodom' | 'olx' | 'morizon';
          city: string;
          district: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          price: number;
          size_m2: number;
          rooms?: number | null;
          offer_type?: 'sale' | 'rent';
          url: string;
          title?: string | null;
          scraped_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          source?: 'otodom' | 'olx' | 'morizon';
          city?: string;
          district?: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          price?: number;
          size_m2?: number;
          rooms?: number | null;
          offer_type?: 'sale' | 'rent';
          url?: string;
          title?: string | null;
          scraped_at?: string;
          created_at?: string;
        };
      };
      district_stats: {
        Row: {
          id: string;
          city: string;
          district: string;
          date: string;
          avg_price_m2: number | null;
          median_price_m2: number | null;
          min_price_m2: number | null;
          max_price_m2: number | null;
          p10_price_m2: number | null;
          p90_price_m2: number | null;
          stddev_price_m2: number | null;
          listing_count: number | null;
          new_listings: number | null;
          avg_size_m2: number | null;
          count_1room: number;
          count_2room: number;
          count_3room: number;
          count_4plus: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          district: string;
          date: string;
          avg_price_m2?: number | null;
          median_price_m2?: number | null;
          min_price_m2?: number | null;
          max_price_m2?: number | null;
          p10_price_m2?: number | null;
          p90_price_m2?: number | null;
          stddev_price_m2?: number | null;
          listing_count?: number | null;
          new_listings?: number | null;
          avg_size_m2?: number | null;
          count_1room?: number;
          count_2room?: number;
          count_3room?: number;
          count_4plus?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          district?: string;
          date?: string;
          avg_price_m2?: number | null;
          median_price_m2?: number | null;
          min_price_m2?: number | null;
          max_price_m2?: number | null;
          p10_price_m2?: number | null;
          p90_price_m2?: number | null;
          stddev_price_m2?: number | null;
          listing_count?: number | null;
          new_listings?: number | null;
          avg_size_m2?: number | null;
          count_1room?: number;
          count_2room?: number;
          count_3room?: number;
          count_4plus?: number;
          created_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          user_email: string;
          city: string;
          district: string | null;
          max_price: number | null;
          min_size_m2: number | null;
          max_price_per_m2: number | null;
          rooms: number[] | null;
          is_active: boolean;
          last_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_email: string;
          city: string;
          district?: string | null;
          max_price?: number | null;
          min_size_m2?: number | null;
          max_price_per_m2?: number | null;
          rooms?: number[] | null;
          is_active?: boolean;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_email?: string;
          city?: string;
          district?: string | null;
          max_price?: number | null;
          min_size_m2?: number | null;
          max_price_per_m2?: number | null;
          rooms?: number[] | null;
          is_active?: boolean;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      latest_district_stats: {
        Row: {
          id: string;
          city: string;
          district: string;
          date: string;
          avg_price_m2: number | null;
          median_price_m2: number | null;
          min_price_m2: number | null;
          max_price_m2: number | null;
          p10_price_m2: number | null;
          p90_price_m2: number | null;
          listing_count: number | null;
          new_listings: number | null;
          avg_size_m2: number | null;
          count_1room: number;
          count_2room: number;
          count_3room: number;
          count_4plus: number;
        };
      };
      district_price_changes: {
        Row: {
          city: string;
          district: string;
          current_price: number | null;
          previous_price: number | null;
          change_percent_30d: number | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Helper types for easier usage
export type District = Database['public']['Tables']['districts']['Row'];
export type DistrictInsert = Database['public']['Tables']['districts']['Insert'];

export type Listing = Database['public']['Tables']['listings']['Row'];
export type ListingInsert = Database['public']['Tables']['listings']['Insert'];

export type DistrictStats = Database['public']['Tables']['district_stats']['Row'];
export type DistrictStatsInsert = Database['public']['Tables']['district_stats']['Insert'];

export type Alert = Database['public']['Tables']['alerts']['Row'];
export type AlertInsert = Database['public']['Tables']['alerts']['Insert'];

export type LatestDistrictStats = Database['public']['Views']['latest_district_stats']['Row'];
export type DistrictPriceChange = Database['public']['Views']['district_price_changes']['Row'];

// Source types
export type ListingSource = 'otodom' | 'olx' | 'morizon';
export type OfferType = 'sale' | 'rent';
