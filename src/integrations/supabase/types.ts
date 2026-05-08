export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      chats: {
        Row: {
          id: string;
          opportunity_id: string;
          user_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          user_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          opportunity_id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      prototypes: {
        Row: {
          id: string;
          user_id: string | null;
          owner_email: string | null;
          guest_id: string | null;
          owner_type: string;
          opportunity_id: string | null;
          source_type: string;
          source_idea_id: string | null;
          name: string;
          thumbnail_url: string | null;
          deployed_url: string | null;
          status: string;
          email: string;
          business_context: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          owner_email?: string | null;
          guest_id?: string | null;
          owner_type?: string;
          opportunity_id?: string | null;
          source_type?: string;
          source_idea_id?: string | null;
          name: string;
          thumbnail_url?: string | null;
          deployed_url?: string | null;
          status?: string;
          email: string;
          business_context?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          owner_email?: string | null;
          guest_id?: string | null;
          owner_type?: string;
          opportunity_id?: string | null;
          source_type?: string;
          source_idea_id?: string | null;
          name?: string;
          thumbnail_url?: string | null;
          deployed_url?: string | null;
          status?: string;
          email?: string;
          business_context?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_ideas: {
        Row: {
          id: string;
          user_id: string | null;
          owner_email: string | null;
          guest_id: string | null;
          owner_type: string;
          title: string;
          description: string;
          category: string;
          tags: string[];
          files: Json;
          video_url: string | null;
          research_results: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          owner_email?: string | null;
          guest_id?: string | null;
          owner_type?: string;
          title: string;
          description?: string;
          category?: string;
          tags?: string[];
          files?: Json;
          video_url?: string | null;
          research_results?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          owner_email?: string | null;
          guest_id?: string | null;
          owner_type?: string;
          title?: string;
          description?: string;
          category?: string;
          tags?: string[];
          files?: Json;
          video_url?: string | null;
          research_results?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_runs: {
        Row: {
          id: string;
          created_at: string;
          guest_id: string;
          owner_email: string | null;
          mode: string;
          topic: string;
          result_count: number;
          total_scanned: number | null;
          messages: Json;
          message: string | null;
          empty: boolean;
          opportunities: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          guest_id: string;
          owner_email?: string | null;
          mode: string;
          topic: string;
          result_count?: number;
          total_scanned?: number | null;
          messages?: Json;
          message?: string | null;
          empty?: boolean;
          opportunities?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          guest_id?: string;
          owner_email?: string | null;
          mode?: string;
          topic?: string;
          result_count?: number;
          total_scanned?: number | null;
          messages?: Json;
          message?: string | null;
          empty?: boolean;
          opportunities?: Json;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          competitors: Json;
          created_at: string;
          icp: string;
          id: string;
          is_hot: boolean;
          mvp_features: string[];
          pain_description: string;
          pain_summary: string;
          sources: string[];
          tam_estimate: string;
          title: string;
          urgency_score: number;
          why_now: string;
        };
        Insert: {
          competitors?: Json;
          created_at?: string;
          icp: string;
          id?: string;
          is_hot?: boolean;
          mvp_features?: string[];
          pain_description: string;
          pain_summary: string;
          sources?: string[];
          tam_estimate: string;
          title: string;
          urgency_score: number;
          why_now: string;
        };
        Update: {
          competitors?: Json;
          created_at?: string;
          icp?: string;
          id?: string;
          is_hot?: boolean;
          mvp_features?: string[];
          pain_description?: string;
          pain_summary?: string;
          sources?: string[];
          tam_estimate?: string;
          title?: string;
          urgency_score?: number;
          why_now?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
