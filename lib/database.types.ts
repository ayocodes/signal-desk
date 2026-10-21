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
      agent_configs: {
        Row: {
          change_summary: Json
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          restored_from: number | null
          rules: Json
          version: number
        }
        Insert: {
          change_summary?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          restored_from?: number | null
          rules: Json
          version: number
        }
        Update: {
          change_summary?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          restored_from?: number | null
          rules?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          config_version: number | null
          created_at: string
          errors: Json
          finished_at: string | null
          id: string
          org_id: string
          started_at: string
          stats: Json
          step_ms: Json
          trigger: string
        }
        Insert: {
          config_version?: number | null
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          org_id: string
          started_at?: string
          stats?: Json
          step_ms?: Json
          trigger: string
        }
        Update: {
          config_version?: number | null
          created_at?: string
          errors?: Json
          finished_at?: string | null
          id?: string
          org_id?: string
          started_at?: string
          stats?: Json
          step_ms?: Json
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ats_checked: Json
          ats_probed_at: string | null
          ats_token: string | null
          ats_type: Database["public"]["Enums"]["ats_type"] | null
          created_at: string
          description: string | null
          domain: string
          icp_match: boolean
          icp_reasons: Json
          icp_tier: Database["public"]["Enums"]["icp_tier"] | null
          id: string
          industries: string[]
          jobs_fetched_at: string | null
          name: string
          org_id: string
          team_size: number | null
          yc_batch: string | null
          yc_is_hiring: boolean
          yc_slug: string | null
        }
        Insert: {
          ats_checked?: Json
          ats_probed_at?: string | null
          ats_token?: string | null
          ats_type?: Database["public"]["Enums"]["ats_type"] | null
          created_at?: string
          description?: string | null
          domain: string
          icp_match?: boolean
          icp_reasons?: Json
          icp_tier?: Database["public"]["Enums"]["icp_tier"] | null
          id?: string
          industries?: string[]
          jobs_fetched_at?: string | null
          name: string
          org_id: string
          team_size?: number | null
          yc_batch?: string | null
          yc_is_hiring?: boolean
          yc_slug?: string | null
        }
        Update: {
          ats_checked?: Json
          ats_probed_at?: string | null
          ats_token?: string | null
          ats_type?: Database["public"]["Enums"]["ats_type"] | null
          created_at?: string
          description?: string | null
          domain?: string
          icp_match?: boolean
          icp_reasons?: Json
          icp_tier?: Database["public"]["Enums"]["icp_tier"] | null
          id?: string
          industries?: string[]
          jobs_fetched_at?: string | null
          name?: string
          org_id?: string
          team_size?: number | null
          yc_batch?: string | null
          yc_is_hiring?: boolean
          yc_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          buyer_reason: string | null
          buyer_status: Database["public"]["Enums"]["buyer_status"]
          company_id: string
          created_at: string
          id: string
          is_placeholder: boolean
          name: string
          org_id: string
          send_address: string
          title: string | null
        }
        Insert: {
          buyer_reason?: string | null
          buyer_status?: Database["public"]["Enums"]["buyer_status"]
          company_id: string
          created_at?: string
          id?: string
          is_placeholder?: boolean
          name: string
          org_id: string
          send_address: string
          title?: string | null
        }
        Update: {
          buyer_reason?: string | null
          buyer_status?: Database["public"]["Enums"]["buyer_status"]
          company_id?: string
          created_at?: string
          id?: string
          is_placeholder?: boolean
          name?: string
          org_id?: string
          send_address?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          angle: Database["public"]["Enums"]["draft_angle"]
          body: string
          created_at: string
          created_by: string | null
          grounded_phrases: Json
          guardrail_results: Json
          id: string
          lead_id: string
          llm_call_id: string | null
          model: string | null
          org_id: string
          passed: boolean
          prompt: string | null
          prompt_hash: string | null
          subject: string
          tokens_in: number | null
          tokens_out: number | null
          trace: Json
        }
        Insert: {
          angle: Database["public"]["Enums"]["draft_angle"]
          body: string
          created_at?: string
          created_by?: string | null
          grounded_phrases?: Json
          guardrail_results?: Json
          id?: string
          lead_id: string
          llm_call_id?: string | null
          model?: string | null
          org_id: string
          passed?: boolean
          prompt?: string | null
          prompt_hash?: string | null
          subject: string
          tokens_in?: number | null
          tokens_out?: number | null
          trace?: Json
        }
        Update: {
          angle?: Database["public"]["Enums"]["draft_angle"]
          body?: string
          created_at?: string
          created_by?: string | null
          grounded_phrases?: Json
          guardrail_results?: Json
          id?: string
          lead_id?: string
          llm_call_id?: string | null
          model?: string | null
          org_id?: string
          passed?: boolean
          prompt?: string | null
          prompt_hash?: string | null
          subject?: string
          tokens_in?: number | null
          tokens_out?: number | null
          trace?: Json
        }
        Relationships: [
          {
            foreignKeyName: "drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_llm_call_id_fkey"
            columns: ["llm_call_id"]
            isOneToOne: false
            referencedRelation: "llm_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payload: Json
          provider_event_id: string | null
          source: Database["public"]["Enums"]["event_source"]
          step_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payload?: Json
          provider_event_id?: string | null
          source: Database["public"]["Enums"]["event_source"]
          step_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          provider_event_id?: string | null
          source?: Database["public"]["Enums"]["event_source"]
          step_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_id: string
          config_version: number | null
          contact_id: string | null
          created_at: string
          filtered_reason: string | null
          id: string
          org_id: string
          score: number
          score_parts: Json
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          config_version?: number | null
          contact_id?: string | null
          created_at?: string
          filtered_reason?: string | null
          id?: string
          org_id: string
          score?: number
          score_parts?: Json
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          config_version?: number | null
          contact_id?: string | null
          created_at?: string
          filtered_reason?: string | null
          id?: string
          org_id?: string
          score?: number
          score_parts?: Json
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_calls: {
        Row: {
          actor_id: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          model: string | null
          ok: boolean | null
          org_id: string
          source: Database["public"]["Enums"]["llm_call_source"]
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          model?: string | null
          ok?: boolean | null
          org_id: string
          source: Database["public"]["Enums"]["llm_call_source"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          model?: string | null
          ok?: boolean | null
          org_id?: string
          source?: Database["public"]["Enums"]["llm_call_source"]
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_calls_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          auth: Json
          created_at: string
          daily_cap: number
          id: string
          label: string
          org_id: string
          pause_reason: string | null
          send_via: string
          sent_today: number
          status: Database["public"]["Enums"]["mailbox_status"]
        }
        Insert: {
          auth?: Json
          created_at?: string
          daily_cap: number
          id?: string
          label: string
          org_id: string
          pause_reason?: string | null
          send_via: string
          sent_today?: number
          status?: Database["public"]["Enums"]["mailbox_status"]
        }
        Update: {
          auth?: Json
          created_at?: string
          daily_cap?: number
          id?: string
          label?: string
          org_id?: string
          pause_reason?: string | null
          send_via?: string
          sent_today?: number
          status?: Database["public"]["Enums"]["mailbox_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          icp_description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icp_description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icp_description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          theme: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          theme?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          mailbox_id: string | null
          message_id: string | null
          org_id: string
          scheduled_for: string
          sequence_id: string
          signal_id: string | null
          status: Database["public"]["Enums"]["step_status"]
          step_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          mailbox_id?: string | null
          message_id?: string | null
          org_id: string
          scheduled_for: string
          sequence_id: string
          signal_id?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_key: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          mailbox_id?: string | null
          message_id?: string | null
          org_id?: string
          scheduled_for?: string
          sequence_id?: string
          signal_id?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_step: string | null
          draft_id: string | null
          edited: boolean
          final_body: string
          final_subject: string
          id: string
          lead_id: string
          org_id: string
          status: Database["public"]["Enums"]["sequence_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_step?: string | null
          draft_id?: string | null
          edited?: boolean
          final_body: string
          final_subject: string
          id?: string
          lead_id: string
          org_id: string
          status?: Database["public"]["Enums"]["sequence_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_step?: string | null
          draft_id?: string | null
          edited?: boolean
          final_body?: string
          final_subject?: string
          id?: string
          lead_id?: string
          org_id?: string
          status?: Database["public"]["Enums"]["sequence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sequences_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          company_id: string
          created_at: string
          detected_at: string
          excerpt: string | null
          fingerprint: string
          id: string
          meta: Json
          occurred_at: string | null
          org_id: string
          source_name: string
          source_url: string | null
          title: string
          type: Database["public"]["Enums"]["signal_type"]
        }
        Insert: {
          company_id: string
          created_at?: string
          detected_at?: string
          excerpt?: string | null
          fingerprint: string
          id?: string
          meta?: Json
          occurred_at?: string | null
          org_id: string
          source_name: string
          source_url?: string | null
          title: string
          type: Database["public"]["Enums"]["signal_type"]
        }
        Update: {
          company_id?: string
          created_at?: string
          detected_at?: string
          excerpt?: string | null
          fingerprint?: string
          id?: string
          meta?: Json
          occurred_at?: string | null
          org_id?: string
          source_name?: string
          source_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["signal_type"]
        }
        Relationships: [
          {
            foreignKeyName: "signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_lead: {
        Args: {
          p_actor: string
          p_body: string
          p_draft: string
          p_lead: string
          p_steps: Json
          p_subject: string
        }
        Returns: string
      }
      lead_status_counts: {
        Args: never
        Returns: {
          status: Database["public"]["Enums"]["lead_status"]
          total: number
        }[]
      }
      llm_calls_today: { Args: never; Returns: number }
      reserve_llm_call: {
        Args: {
          p_actor: string
          p_actor_hourly_limit?: number
          p_daily_limit: number
          p_lead: string
          p_org: string
          p_source: Database["public"]["Enums"]["llm_call_source"]
        }
        Returns: {
          call_id: string
          refusal: string
        }[]
      }
      save_agent_config: {
        Args: { p_restored_from?: number; p_rules: Json; p_summary: Json }
        Returns: number
      }
      threshold_preview: {
        Args: { p_threshold: number; p_weak: string[] }
        Returns: {
          ready_now: number
          would_be_ready: number
        }[]
      }
    }
    Enums: {
      actor_type: "agent" | "user"
      app_role: "admin" | "rep"
      ats_type: "greenhouse" | "lever" | "ashby"
      buyer_status: "verified" | "rerouted" | "unverified"
      draft_angle: "signal" | "peer" | "short" | "raw"
      event_source: "resend" | "simulated"
      icp_tier: "full" | "partial"
      lead_status:
        | "ready"
        | "filtered"
        | "enrolled"
        | "bounced"
        | "replied"
        | "halted"
        | "completed"
      llm_call_source: "agent" | "regenerate" | "unconstrained"
      mailbox_status: "healthy" | "near_cap" | "paused" | "held"
      sequence_status: "active" | "paused" | "halted" | "completed"
      signal_type: "hiring" | "launch" | "funding"
      step_status: "pending" | "sent" | "skipped" | "cancelled"
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
    Enums: {
      actor_type: ["agent", "user"],
      app_role: ["admin", "rep"],
      ats_type: ["greenhouse", "lever", "ashby"],
      buyer_status: ["verified", "rerouted", "unverified"],
      draft_angle: ["signal", "peer", "short", "raw"],
      event_source: ["resend", "simulated"],
      icp_tier: ["full", "partial"],
      lead_status: [
        "ready",
        "filtered",
        "enrolled",
        "bounced",
        "replied",
        "halted",
        "completed",
      ],
      llm_call_source: ["agent", "regenerate", "unconstrained"],
      mailbox_status: ["healthy", "near_cap", "paused", "held"],
      sequence_status: ["active", "paused", "halted", "completed"],
      signal_type: ["hiring", "launch", "funding"],
      step_status: ["pending", "sent", "skipped", "cancelled"],
    },
  },
} as const
