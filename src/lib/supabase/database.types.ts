/**
 * Database types for the public schema.
 * Keep in sync with supabase/migrations — regenerate with `npm run db:types`
 * once a local Supabase stack is running.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          active_workspace: Database["public"]["Enums"]["workspace_role"];
          avatar_path: string | null;
          bio: string | null;
          city: string | null;
          created_at: string;
          full_name: string;
          id: string;
          onboarding_completed_at: string | null;
          phone: string | null;
          updated_at: string;
          workspace_chosen_at: string | null;
        };
        Insert: {
          active_workspace?: Database["public"]["Enums"]["workspace_role"];
          avatar_path?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          onboarding_completed_at?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_chosen_at?: string | null;
        };
        Update: {
          active_workspace?: Database["public"]["Enums"]["workspace_role"];
          avatar_path?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          onboarding_completed_at?: string | null;
          phone?: string | null;
          updated_at?: string;
          workspace_chosen_at?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["platform_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      has_platform_role: {
        Args: { _role: Database["public"]["Enums"]["platform_role"] };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      platform_role: "admin";
      workspace_role: "advertiser" | "influencer";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
