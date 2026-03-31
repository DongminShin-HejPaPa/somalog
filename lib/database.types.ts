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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      daily_logs: {
        Row: {
          avg_weight_3d: number | null
          breakfast: string | null
          closed: boolean
          created_at: string
          daily_summary: string | null
          date: string
          day: number
          dinner: string | null
          energy: string | null
          exercise: string | null
          feedback: string | null
          id: string
          intensive_day: boolean | null
          late_snack: string | null
          lunch: string | null
          note: string | null
          one_liner: string | null
          updated_at: string
          user_id: string
          water: number | null
          weight: number | null
          weight_change: number | null
        }
        Insert: {
          avg_weight_3d?: number | null
          breakfast?: string | null
          closed?: boolean
          created_at?: string
          daily_summary?: string | null
          date: string
          day?: number
          dinner?: string | null
          energy?: string | null
          exercise?: string | null
          feedback?: string | null
          id?: string
          intensive_day?: boolean | null
          late_snack?: string | null
          lunch?: string | null
          note?: string | null
          one_liner?: string | null
          updated_at?: string
          user_id: string
          water?: number | null
          weight?: number | null
          weight_change?: number | null
        }
        Update: {
          avg_weight_3d?: number | null
          breakfast?: string | null
          closed?: boolean
          created_at?: string
          daily_summary?: string | null
          date?: string
          day?: number
          dinner?: string | null
          energy?: string | null
          exercise?: string | null
          feedback?: string | null
          id?: string
          intensive_day?: boolean | null
          late_snack?: string | null
          lunch?: string | null
          note?: string | null
          one_liner?: string | null
          updated_at?: string
          user_id?: string
          water?: number | null
          weight?: number | null
          weight_change?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          coach_name: string
          coach_style_extra: string[]
          coach_style_preset: string
          created_at: string
          current_weight: number
          default_tab: string
          diet_preset: string
          diet_start_date: string
          gender: string
          height: number
          intensive_day_criteria: string
          intensive_day_on: boolean
          onboarding_complete: boolean
          routine_energy_time: string
          routine_extra: string[]
          routine_weight_time: string
          start_weight: number
          target_months: number
          target_weight: number
          updated_at: string
          user_id: string
          water_goal: number
        }
        Insert: {
          coach_name?: string
          coach_style_extra?: string[]
          coach_style_preset?: string
          created_at?: string
          current_weight?: number
          default_tab?: string
          diet_preset?: string
          diet_start_date?: string
          gender?: string
          height?: number
          intensive_day_criteria?: string
          intensive_day_on?: boolean
          onboarding_complete?: boolean
          routine_energy_time?: string
          routine_extra?: string[]
          routine_weight_time?: string
          start_weight?: number
          target_months?: number
          target_weight?: number
          updated_at?: string
          user_id: string
          water_goal?: number
        }
        Update: {
          coach_name?: string
          coach_style_extra?: string[]
          coach_style_preset?: string
          created_at?: string
          current_weight?: number
          default_tab?: string
          diet_preset?: string
          diet_start_date?: string
          gender?: string
          height?: number
          intensive_day_criteria?: string
          intensive_day_on?: boolean
          onboarding_complete?: boolean
          routine_energy_time?: string
          routine_extra?: string[]
          routine_weight_time?: string
          start_weight?: number
          target_months?: number
          target_weight?: number
          updated_at?: string
          user_id?: string
          water_goal?: number
        }
        Relationships: []
      }
      weekly_logs: {
        Row: {
          avg_weight: number
          created_at: string
          exercise_days: number
          id: string
          late_snack_count: number
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
          weekly_summary: string
        }
        Insert: {
          avg_weight?: number
          created_at?: string
          exercise_days?: number
          id?: string
          late_snack_count?: number
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
          weekly_summary?: string
        }
        Update: {
          avg_weight?: number
          created_at?: string
          exercise_days?: number
          id?: string
          late_snack_count?: number
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
          weekly_summary?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
