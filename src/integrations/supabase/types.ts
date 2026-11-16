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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          body: string | null
          ciphertext: string
          created_at: string
          id: string
          iv: string
          recipient_id: string | null
          sender_id: string
          wrapped_keys: Json | null
        }
        Insert: {
          body?: string | null
          ciphertext: string
          created_at?: string
          id?: string
          iv: string
          recipient_id?: string | null
          sender_id?: string
          wrapped_keys?: Json | null
        }
        Update: {
          body?: string | null
          ciphertext?: string
          created_at?: string
          id?: string
          iv?: string
          recipient_id?: string | null
          sender_id?: string
          wrapped_keys?: Json | null
        }
        Relationships: []
      }
      counters: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          description: string
          id: string
          name: string
          position: number
          role: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          position?: number
          role?: string | null
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tally_days: {
        Row: {
          calls_assigned: number
          counts: Json
          day: string
          report: Json | null
          report_saved_at: string | null
          updated_at: string
          user_id: string
          visitors: Json
        }
        Insert: {
          calls_assigned?: number
          counts?: Json
          day: string
          report?: Json | null
          report_saved_at?: string | null
          updated_at?: string
          user_id?: string
          visitors?: Json
        }
        Update: {
          calls_assigned?: number
          counts?: Json
          day?: string
          report?: Json | null
          report_saved_at?: string | null
          updated_at?: string
          user_id?: string
          visitors?: Json
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          full_name: string
          joined_at: string
          last_seen_at: string | null
          public_key: Json
          user_id: string
        }
        Insert: {
          full_name: string
          joined_at?: string
          last_seen_at?: string | null
          public_key: Json
          user_id: string
        }
        Update: {
          full_name?: string
          joined_at?: string
          last_seen_at?: string | null
          public_key?: Json
          user_id?: string
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          id: number
          join_code: string
        }
        Insert: {
          id?: number
          join_code: string
        }
        Update: {
          id?: number
          join_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_daily_progress: {
        Args: { _day: string }
        Returns: {
          calls_assigned: number
          dialed: number
          full_name: string
          last_seen_at: string
          updated_at: string
          user_id: string
        }[]
      }
      initialize_counters: { Args: never; Returns: undefined }
      is_workspace_member: { Args: { _uid: string }; Returns: boolean }
      join_workspace: {
        Args: { _code: string; _full_name: string; _public_key: Json }
        Returns: boolean
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
