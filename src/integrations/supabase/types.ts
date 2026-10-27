export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar_feeds: {
        Row: {
          created_at: string
          household_id: string
          ics_url: string
          id: string
          last_synced_at: string | null
          person: string
          show_details: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          ics_url: string
          id?: string
          last_synced_at?: string | null
          person: string
          show_details?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          ics_url?: string
          id?: string
          last_synced_at?: string | null
          person?: string
          show_details?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          household_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          household_id: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          category_manual: boolean
          created_at: string
          created_by: string | null
          from_shopping_trip: boolean
          household_id: string
          id: string
          note: string | null
          paid_by: string
          receipt_path: string | null
          spent_on: string
          store: string | null
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          category_manual?: boolean
          created_at?: string
          created_by?: string | null
          from_shopping_trip?: boolean
          household_id: string
          id?: string
          note?: string | null
          paid_by: string
          receipt_path?: string | null
          spent_on?: string
          store?: string | null
          title: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          category_manual?: boolean
          created_at?: string
          created_by?: string | null
          from_shopping_trip?: boolean
          household_id?: string
          id?: string
          note?: string | null
          paid_by?: string
          receipt_path?: string | null
          spent_on?: string
          store?: string | null
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          person: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          person: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          person?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          cuisine_prefs: Json
          id: string
          invite_code: string
          name: string
          preferred_k_store: string | null
          preferred_s_store: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cuisine_prefs?: Json
          id?: string
          invite_code?: string
          name?: string
          preferred_k_store?: string | null
          preferred_s_store?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cuisine_prefs?: Json
          id?: string
          invite_code?: string
          name?: string
          preferred_k_store?: string | null
          preferred_s_store?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      merchant_categories: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          merchant_key: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          household_id: string
          id?: string
          merchant_key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          merchant_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_import_runs: {
        Row: {
          last_attempt_at: string | null
          last_success_at: string | null
          message: string | null
          offers_imported: number
          pages_used: string[]
          retailer: string
          status: string
        }
        Insert: {
          last_attempt_at?: string | null
          last_success_at?: string | null
          message?: string | null
          offers_imported?: number
          pages_used?: string[]
          retailer: string
          status?: string
        }
        Update: {
          last_attempt_at?: string | null
          last_success_at?: string | null
          message?: string | null
          offers_imported?: number
          pages_used?: string[]
          retailer?: string
          status?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          category: string
          created_at: string
          household_id: string
          id: string
          is_staple: boolean
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          household_id: string
          id?: string
          is_staple?: boolean
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          is_staple?: boolean
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_meals: {
        Row: {
          at_home: string[]
          created_at: string
          created_by: string | null
          cuisine: string | null
          household_id: string
          id: string
          missing: string[]
          name: string
          plan_date: string
          prep_minutes: number | null
          slot: string
          staples_used: string[]
          toddler_friendly: boolean
          toddler_note: string | null
          updated_at: string
        }
        Insert: {
          at_home?: string[]
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          household_id: string
          id?: string
          missing?: string[]
          name: string
          plan_date: string
          prep_minutes?: number | null
          slot?: string
          staples_used?: string[]
          toddler_friendly?: boolean
          toddler_note?: string | null
          updated_at?: string
        }
        Update: {
          at_home?: string[]
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          household_id?: string
          id?: string
          missing?: string[]
          name?: string
          plan_date?: string
          prep_minutes?: number | null
          slot?: string
          staples_used?: string[]
          toddler_friendly?: boolean
          toddler_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_meals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_items: {
        Row: {
          bought_by: string
          created_at: string
          created_by: string | null
          expense_id: string | null
          household_id: string
          id: string
          line_total: number | null
          name: string
          purchased_on: string
          quantity: number | null
          shopping_item_id: string | null
          store: string | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          bought_by: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          household_id: string
          id?: string
          line_total?: number | null
          name: string
          purchased_on?: string
          quantity?: number | null
          shopping_item_id?: string | null
          store?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          bought_by?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          household_id?: string
          id?: string
          line_total?: number | null
          name?: string
          purchased_on?: string
          quantity?: number | null
          shopping_item_id?: string | null
          store?: string | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchased_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchased_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          added_by: string | null
          added_by_name: string
          category: string
          created_at: string
          frequent: boolean
          household_id: string
          id: string
          name: string
          note: string | null
          purchased_at: string | null
          quantity: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_by_name?: string
          category?: string
          created_at?: string
          frequent?: boolean
          household_id: string
          id?: string
          name: string
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_by_name?: string
          category?: string
          created_at?: string
          frequent?: boolean
          household_id?: string
          id?: string
          name?: string
          note?: string | null
          purchased_at?: string | null
          quantity?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      supermarket_offers: {
        Row: {
          category: string
          created_at: string
          discount_pct: number | null
          ends_on: string
          external_id: string | null
          id: string
          image_last_verified_at: string | null
          image_source_type: string | null
          image_source_url: string | null
          image_url: string | null
          last_updated: string
          lidl_plus_required: boolean
          normal_price: number | null
          normalized_name: string
          package_size: string | null
          product_name: string
          promo_price: number
          retailer: string
          source_type: string
          source_url: string | null
          starts_on: string | null
          store_id: string | null
          store_location: string | null
          store_name: string | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          discount_pct?: number | null
          ends_on: string
          external_id?: string | null
          id?: string
          image_last_verified_at?: string | null
          image_source_type?: string | null
          image_source_url?: string | null
          image_url?: string | null
          last_updated?: string
          lidl_plus_required?: boolean
          normal_price?: number | null
          normalized_name: string
          package_size?: string | null
          product_name: string
          promo_price: number
          retailer: string
          source_type?: string
          source_url?: string | null
          starts_on?: string | null
          store_id?: string | null
          store_location?: string | null
          store_name?: string | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          discount_pct?: number | null
          ends_on?: string
          external_id?: string | null
          id?: string
          image_last_verified_at?: string | null
          image_source_type?: string | null
          image_source_url?: string | null
          image_url?: string | null
          last_updated?: string
          lidl_plus_required?: boolean
          normal_price?: number | null
          normalized_name?: string
          package_size?: string | null
          product_name?: string
          promo_price?: number
          retailer?: string
          source_type?: string
          source_url?: string | null
          starts_on?: string | null
          store_id?: string | null
          store_location?: string | null
          store_name?: string | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household:
        | { Args: { _child_name?: string; _person: string }; Returns: string }
        | {
            Args: { _child_name?: string; _home_name?: string; _person: string }
            Returns: string
          }
      is_household_member: { Args: { _household_id: string }; Returns: boolean }
      join_household: {
        Args: { _code: string; _person: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
