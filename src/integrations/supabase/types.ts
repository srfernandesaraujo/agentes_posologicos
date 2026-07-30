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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_active_skills: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          skill_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          skill_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          skill_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_active_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "custom_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_active_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "agent_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_flow_edges: {
        Row: {
          branch_key: string | null
          flow_id: string
          id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          branch_key?: string | null
          flow_id: string
          id?: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          branch_key?: string | null
          flow_id?: string
          id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "agent_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "agent_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_flow_executions: {
        Row: {
          completed_at: string | null
          final_output: string | null
          flow_id: string
          id: string
          initial_input: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          final_output?: string | null
          flow_id: string
          id?: string
          initial_input?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          final_output?: string | null
          flow_id?: string
          id?: string
          initial_input?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_flow_node_results: {
        Row: {
          completed_at: string | null
          execution_id: string
          id: string
          input_text: string
          node_id: string
          output_text: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          execution_id: string
          id?: string
          input_text?: string
          node_id: string
          output_text?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          execution_id?: string
          id?: string
          input_text?: string
          node_id?: string
          output_text?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_flow_node_results_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "agent_flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_flow_node_results_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "agent_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_flow_nodes: {
        Row: {
          agent_id: string
          agent_type: string
          branch_key: string
          created_at: string
          flow_id: string
          id: string
          input_prompt: string
          is_router: boolean
          is_synthesizer: boolean
          position_x: number
          position_y: number
          router_branches: Json
          sort_order: number
        }
        Insert: {
          agent_id: string
          agent_type?: string
          branch_key?: string
          created_at?: string
          flow_id: string
          id?: string
          input_prompt?: string
          is_router?: boolean
          is_synthesizer?: boolean
          position_x?: number
          position_y?: number
          router_branches?: Json
          sort_order?: number
        }
        Update: {
          agent_id?: string
          agent_type?: string
          branch_key?: string
          created_at?: string
          flow_id?: string
          id?: string
          input_prompt?: string
          is_router?: boolean
          is_synthesizer?: boolean
          position_x?: number
          position_y?: number
          router_branches?: Json
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_flows: {
        Row: {
          category: string | null
          created_at: string
          creator_earnings: number
          description: string
          execution_mode: string
          forked_from: string | null
          id: string
          input_type: string | null
          installs_count: number
          name: string
          published: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_earnings?: number
          description?: string
          execution_mode?: string
          forked_from?: string | null
          id?: string
          input_type?: string | null
          installs_count?: number
          name: string
          published?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_earnings?: number
          description?: string
          execution_mode?: string
          forked_from?: string | null
          id?: string
          input_type?: string | null
          installs_count?: number
          name?: string
          published?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_flows_forked_from_fkey"
            columns: ["forked_from"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_bases: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          knowledge_base_id: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          knowledge_base_id: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          knowledge_base_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_bases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "custom_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_bases_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_optimization_runs: {
        Row: {
          agent_id: string
          agent_type: string
          comments_used: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          feedback_count: number | null
          feedback_window_end: string | null
          feedback_window_start: string | null
          generated_version_id: string | null
          id: string
          model_used: string | null
          negative_count: number | null
          positive_count: number | null
          provider_used: string | null
          status: string
          triggered_by: string
        }
        Insert: {
          agent_id: string
          agent_type: string
          comments_used?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feedback_count?: number | null
          feedback_window_end?: string | null
          feedback_window_start?: string | null
          generated_version_id?: string | null
          id?: string
          model_used?: string | null
          negative_count?: number | null
          positive_count?: number | null
          provider_used?: string | null
          status?: string
          triggered_by?: string
        }
        Update: {
          agent_id?: string
          agent_type?: string
          comments_used?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          feedback_count?: number | null
          feedback_window_end?: string | null
          feedback_window_start?: string | null
          generated_version_id?: string | null
          id?: string
          model_used?: string | null
          negative_count?: number | null
          positive_count?: number | null
          provider_used?: string | null
          status?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_optimization_runs_generated_version_id_fkey"
            columns: ["generated_version_id"]
            isOneToOne: false
            referencedRelation: "agent_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_optimization_settings: {
        Row: {
          agent_id: string
          agent_type: string
          auto_apply: boolean
          auto_optimize_enabled: boolean
          created_at: string
          id: string
          last_run_at: string | null
          min_feedbacks: number
          negative_threshold: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          agent_type: string
          auto_apply?: boolean
          auto_optimize_enabled?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          min_feedbacks?: number
          negative_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          agent_type?: string
          auto_apply?: boolean
          auto_optimize_enabled?: boolean
          created_at?: string
          id?: string
          last_run_at?: string | null
          min_feedbacks?: number
          negative_threshold?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_prompt_versions: {
        Row: {
          activated_at: string | null
          agent_id: string
          agent_type: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          feedback_negative: number | null
          feedback_positive: number | null
          feedback_window_end: string | null
          feedback_window_start: string | null
          id: string
          origin: string
          status: string
          system_prompt: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          agent_id: string
          agent_type: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          feedback_negative?: number | null
          feedback_positive?: number | null
          feedback_window_end?: string | null
          feedback_window_start?: string | null
          id?: string
          origin?: string
          status?: string
          system_prompt: string
          version: number
        }
        Update: {
          activated_at?: string | null
          agent_id?: string
          agent_type?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          feedback_negative?: number | null
          feedback_positive?: number | null
          feedback_window_end?: string | null
          feedback_window_start?: string | null
          id?: string
          origin?: string
          status?: string
          system_prompt?: string
          version?: number
        }
        Relationships: []
      }
      agent_reviews: {
        Row: {
          agent_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "custom_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_global: boolean
          name: string
          prompt_snippet: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_global?: boolean
          name: string
          prompt_snippet?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_global?: boolean
          name?: string
          prompt_snippet?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          active: boolean
          category: string
          created_at: string
          credit_cost: number
          description: string
          icon: string
          id: string
          model: string | null
          name: string
          provider: string | null
          slug: string
          system_prompt: string | null
          temperature: number | null
          voice_id: string | null
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string
          icon?: string
          id?: string
          model?: string | null
          name: string
          provider?: string | null
          slug: string
          system_prompt?: string | null
          temperature?: number | null
          voice_id?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          credit_cost?: number
          description?: string
          icon?: string
          id?: string
          model?: string | null
          name?: string
          provider?: string | null
          slug?: string
          system_prompt?: string | null
          temperature?: number | null
          voice_id?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          estimated_cost_usd: number | null
          id: string
          model: string | null
          prompt_type: string | null
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page: string | null
          session_id: string
          user_id: string | null
          utm_campaign: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page?: string | null
          session_id: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page?: string | null
          session_id?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      briefing_settings: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_sent_at: string | null
          send_hour: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_sent_at?: string | null
          send_hour?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_sent_at?: string | null
          send_hour?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          created_at: string
          delivered_email: boolean
          id: string
          sections: Json
          summary: string | null
          title: string
          transcript: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_email?: boolean
          id?: string
          sections?: Json
          summary?: string | null
          title: string
          transcript: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_email?: boolean
          id?: string
          sections?: Json
          summary?: string | null
          title?: string
          transcript?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_certificates: {
        Row: {
          agent_name: string
          content_hash: string
          content_preview: string
          created_at: string
          id: string
          message_id: string | null
          metadata: Json | null
          session_id: string | null
          user_id: string
          verification_code: string
        }
        Insert: {
          agent_name?: string
          content_hash: string
          content_preview?: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id: string
          verification_code: string
        }
        Update: {
          agent_name?: string
          content_hash?: string
          content_preview?: string
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string
          verification_code?: string
        }
        Relationships: []
      }
      credits_ledger: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_agents: {
        Row: {
          created_at: string
          description: string
          id: string
          knowledge_base_id: string | null
          markdown_response: boolean
          model: string
          name: string
          provider: string
          publish_virtual_patient: boolean
          publish_whatsapp: boolean
          published_to_marketplace: boolean
          restrict_content: boolean
          status: string
          system_prompt: string
          temperature: number
          updated_at: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          knowledge_base_id?: string | null
          markdown_response?: boolean
          model?: string
          name: string
          provider?: string
          publish_virtual_patient?: boolean
          publish_whatsapp?: boolean
          published_to_marketplace?: boolean
          restrict_content?: boolean
          status?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          knowledge_base_id?: string | null
          markdown_response?: boolean
          model?: string
          name?: string
          provider?: string
          publish_virtual_patient?: boolean
          publish_whatsapp?: boolean
          published_to_marketplace?: boolean
          restrict_content?: boolean
          status?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_agents_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_installs: {
        Row: {
          buyer_id: string
          created_at: string
          credits_spent: number
          id: string
          installed_flow_id: string
          seller_id: string
          source_flow_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          credits_spent?: number
          id?: string
          installed_flow_id: string
          seller_id: string
          source_flow_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          credits_spent?: number
          id?: string
          installed_flow_id?: string
          seller_id?: string
          source_flow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_installs_installed_flow_id_fkey"
            columns: ["installed_flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_installs_source_flow_id_fkey"
            columns: ["source_flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_reviews: {
        Row: {
          comment: string | null
          created_at: string
          flow_id: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          flow_id: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          flow_id?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_reviews_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "agent_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_members: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          role: Database["public"]["Enums"]["institution_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          role: Database["public"]["Enums"]["institution_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          role?: Database["public"]["Enums"]["institution_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_members_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      knowledge_bases: {
        Row: {
          created_at: string
          description: string
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          content: string
          created_at: string
          file_path: string | null
          id: string
          knowledge_base_id: string
          metadata: Json | null
          name: string
          status: string
          type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          file_path?: string | null
          id?: string
          knowledge_base_id: string
          metadata?: Json | null
          name: string
          status?: string
          type?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_path?: string | null
          id?: string
          knowledge_base_id?: string
          metadata?: Json | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          bot_id: string | null
          created_at: string
          error_message: string | null
          id: string
          meet_link: string
          status: string
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          meet_link: string
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          meet_link?: string
          status?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      osce_attempts: {
        Row: {
          created_at: string
          credits_charged: number
          duration_seconds: number | null
          ended_at: string | null
          exam_id: string | null
          feedback: string | null
          guest_email: string | null
          guest_name: string | null
          guest_token: string | null
          id: string
          max_score: number | null
          rubric_result: Json | null
          score: number | null
          session_id: string | null
          started_at: string
          station_id: string
          status: string
          transcript: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credits_charged?: number
          duration_seconds?: number | null
          ended_at?: string | null
          exam_id?: string | null
          feedback?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          max_score?: number | null
          rubric_result?: Json | null
          score?: number | null
          session_id?: string | null
          started_at?: string
          station_id: string
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credits_charged?: number
          duration_seconds?: number | null
          ended_at?: string | null
          exam_id?: string | null
          feedback?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          max_score?: number | null
          rubric_result?: Json | null
          score?: number | null
          session_id?: string | null
          started_at?: string
          station_id?: string
          status?: string
          transcript?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "osce_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "osce_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "osce_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "osce_exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "osce_attempts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "osce_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      osce_attempt_ratings: {
        Row: {
          attempt_id: string
          created_at: string
          feedback: string
          id: string
          items: Json
          max_score: number
          rater_id: string | null
          rater_type: string
          score: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          feedback?: string
          id?: string
          items?: Json
          max_score?: number
          rater_id?: string | null
          rater_type: string
          score?: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          feedback?: string
          id?: string
          items?: Json
          max_score?: number
          rater_id?: string | null
          rater_type?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "osce_attempt_ratings_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "osce_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      osce_exam_sessions: {
        Row: {
          auto_advance: boolean
          created_at: string
          current_station_index: number
          current_station_started_at: string | null
          exam_id: string
          finished_at: string | null
          id: string
          owner_id: string
          pin: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto_advance?: boolean
          created_at?: string
          current_station_index?: number
          current_station_started_at?: string | null
          exam_id: string
          finished_at?: string | null
          id?: string
          owner_id: string
          pin: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto_advance?: boolean
          created_at?: string
          current_station_index?: number
          current_station_started_at?: string | null
          exam_id?: string
          finished_at?: string | null
          id?: string
          owner_id?: string
          pin?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "osce_exam_sessions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "osce_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      osce_exam_stations: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          order_index: number
          station_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          order_index?: number
          station_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          order_index?: number
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "osce_exam_stations_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "osce_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "osce_exam_stations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "osce_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      osce_exams: {
        Row: {
          access_code: string | null
          created_at: string
          description: string | null
          id: string
          is_open: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      osce_session_participants: {
        Row: {
          current_attempt_id: string | null
          display_name: string | null
          guest_email: string | null
          guest_name: string | null
          guest_token: string | null
          id: string
          joined_at: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          current_attempt_id?: string | null
          display_name?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          joined_at?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          current_attempt_id?: string | null
          display_name?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_token?: string | null
          id?: string
          joined_at?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "osce_session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "osce_exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      osce_stations: {
        Row: {
          created_at: string
          difficulty: string
          duration_minutes: number
          exam_results: Json
          expected_conducts: Json
          expected_questions: Json
          id: string
          institution_id: string | null
          is_public: boolean
          patient_omissions: string | null
          patient_persona: string
          patient_symptoms: string
          rubric: Json
          scenario_brief: string
          specialty: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          exam_results?: Json
          expected_conducts?: Json
          expected_questions?: Json
          id?: string
          institution_id?: string | null
          is_public?: boolean
          patient_omissions?: string | null
          patient_persona: string
          patient_symptoms: string
          rubric?: Json
          scenario_brief: string
          specialty?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          exam_results?: Json
          expected_conducts?: Json
          expected_questions?: Json
          id?: string
          institution_id?: string | null
          is_public?: boolean
          patient_omissions?: string | null
          patient_persona?: string
          patient_symptoms?: string
          rubric?: Json
          scenario_brief?: string
          specialty?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "osce_stations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          project_id: string
          role: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_items: {
        Row: {
          added_at: string
          added_by: string
          id: string
          item_id: string
          item_type: string
          project_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          id?: string
          item_id: string
          item_type: string
          project_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          id?: string
          item_id?: string
          item_type?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pubmed_notifications_log: {
        Row: {
          id: string
          interest_id: string | null
          notified_at: string
          pmid: string
          user_id: string
        }
        Insert: {
          id?: string
          interest_id?: string | null
          notified_at?: string
          pmid: string
          user_id: string
        }
        Update: {
          id?: string
          interest_id?: string | null
          notified_at?: string
          pmid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pubmed_notifications_log_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "user_research_interests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_agents: {
        Row: {
          agent_id: string
          buyer_id: string
          created_at: string
          id: string
          seller_id: string
        }
        Insert: {
          agent_id: string
          buyer_id: string
          created_at?: string
          id?: string
          seller_id: string
        }
        Update: {
          agent_id?: string
          buyer_id?: string
          created_at?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchased_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "custom_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      response_feedback: {
        Row: {
          agent_id: string
          comment: string | null
          created_at: string
          id: string
          message_id: string | null
          rating: string
          room_id: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          rating: string
          room_id?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          rating?: string
          room_id?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_feedback_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_broadcast: boolean
          is_question: boolean
          participant_token: string | null
          role: string
          room_id: string
          sender_email: string | null
          sender_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_broadcast?: boolean
          is_question?: boolean
          participant_token?: string | null
          role?: string
          room_id: string
          sender_email?: string | null
          sender_name?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_broadcast?: boolean
          is_question?: boolean
          participant_token?: string | null
          role?: string
          room_id?: string
          sender_email?: string | null
          sender_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_templates: {
        Row: {
          agent_id: string
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          last_message_at: string
          last_message_from: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_from?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_from?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_updates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          priority: string
          release_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          priority?: string
          release_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          priority?: string
          release_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      turma_enrollments: {
        Row: {
          enrolled_at: string
          id: string
          student_id: string
          turma_id: string
        }
        Insert: {
          enrolled_at?: string
          id?: string
          student_id: string
          turma_id: string
        }
        Update: {
          enrolled_at?: string
          id?: string
          student_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_enrollments_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string
          description: string
          id: string
          institution_id: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          institution_id: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          institution_id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      unlimited_users: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          is_active?: boolean
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key_encrypted: string
          created_at: string
          id: string
          key_expires_at: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          id?: string
          key_expires_at?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          id?: string
          key_expires_at?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memory_facts: {
        Row: {
          active: boolean
          confidence: number
          created_at: string
          fact: string
          id: string
          source_session_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          confidence?: number
          created_at?: string
          fact: string
          id?: string
          source_session_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          confidence?: number
          created_at?: string
          fact?: string
          id?: string
          source_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications_enabled: boolean
          id: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications_enabled?: boolean
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications_enabled?: boolean
          id?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profile_context: {
        Row: {
          area_atuacao: string
          auto_extract_enabled: boolean
          created_at: string
          id: string
          institution: string
          memory_enabled: boolean
          public_target: string
          research_lines: string
          restrictions: string
          tone_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_atuacao?: string
          auto_extract_enabled?: boolean
          created_at?: string
          id?: string
          institution?: string
          memory_enabled?: boolean
          public_target?: string
          research_lines?: string
          restrictions?: string
          tone_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_atuacao?: string
          auto_extract_enabled?: boolean
          created_at?: string
          id?: string
          institution?: string
          memory_enabled?: boolean
          public_target?: string
          research_lines?: string
          restrictions?: string
          tone_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_research_interests: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          terms: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          terms: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          terms?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_rooms: {
        Row: {
          agent_expires_at: string | null
          agent_id: string | null
          created_at: string
          current_broadcast_prompt: string | null
          description: string
          id: string
          is_active: boolean
          live_mode: boolean
          name: string
          pin: string
          room_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_expires_at?: string | null
          agent_id?: string | null
          created_at?: string
          current_broadcast_prompt?: string | null
          description?: string
          id?: string
          is_active?: boolean
          live_mode?: boolean
          name: string
          pin: string
          room_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_expires_at?: string | null
          agent_id?: string | null
          created_at?: string
          current_broadcast_prompt?: string | null
          description?: string
          id?: string
          is_active?: boolean
          live_mode?: boolean
          name?: string
          pin?: string
          room_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          agent_id: string
          created_at: string
          evolution_api_key_encrypted: string | null
          evolution_api_url: string | null
          id: string
          instance_name: string | null
          phone_number_id: string | null
          service_type: string
          status: string
          token: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          evolution_api_key_encrypted?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name?: string | null
          phone_number_id?: string | null
          service_type?: string
          status?: string
          token?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          evolution_api_key_encrypted?: string | null
          evolution_api_url?: string | null
          id?: string
          instance_name?: string | null
          phone_number_id?: string | null
          service_type?: string
          status?: string
          token?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "custom_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          remote_jid: string
          role: string
          whatsapp_connection_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          remote_jid: string
          role?: string
          whatsapp_connection_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          remote_jid?: string
          role?: string
          whatsapp_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_api_key:
        | { Args: { p_encrypted: string }; Returns: string }
        | {
            Args: { p_encrypted: string; p_encryption_key?: string }
            Returns: string
          }
      encrypt_api_key:
        | { Args: { p_key: string }; Returns: string }
        | {
            Args: { p_encryption_key?: string; p_key: string }
            Returns: string
          }
      get_briefing_by_id: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          id: string
          sections: Json
          summary: string
          title: string
          transcript: string
        }[]
      }
      get_current_user_email: { Args: never; Returns: string }
      get_marketplace_agents: {
        Args: never
        Returns: {
          created_at: string
          description: string
          id: string
          markdown_response: boolean
          model: string
          name: string
          provider: string
          restrict_content: boolean
          temperature: number
          updated_at: string
          user_id: string
        }[]
      }
      get_marketplace_flows: {
        Args: never
        Returns: {
          category: string
          created_at: string
          description: string
          execution_mode: string
          id: string
          installs_count: number
          name: string
          user_id: string
        }[]
      }
      get_my_room_messages: {
        Args: { _room_id: string; _token: string }
        Returns: {
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_broadcast: boolean
          is_question: boolean
          participant_token: string
          role: string
          room_id: string
          sender_name: string
        }[]
      }
      get_osce_session_by_pin: {
        Args: { _pin: string }
        Returns: {
          current_station_index: number
          exam_id: string
          id: string
          owner_id: string
          status: string
        }[]
      }
      get_room_by_pin: {
        Args: { p_pin: string }
        Returns: {
          agent_expires_at: string
          agent_id: string
          created_at: string
          current_broadcast_prompt: string
          description: string
          id: string
          is_active: boolean
          live_mode: boolean
          name: string
          pin: string
          room_expires_at: string
          updated_at: string
          user_id: string
        }[]
      }
      get_turma_gradebook: {
        Args: { _turma_id: string }
        Returns: {
          completed_at: string | null
          max_score: number | null
          score: number | null
          station_title: string | null
          student_id: string
          student_name: string | null
        }[]
      }
      has_institution_role: {
        Args: {
          _institution_id: string
          _role: Database["public"]["Enums"]["institution_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_project_access: {
        Args: { _min_role?: string; _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_virtual_room: { Args: { _room_id: string }; Returns: boolean }
      is_institution_member: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      is_osce_session_owner: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_osce_session_participant: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_virtual_room_owner: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      spend_credits: {
        Args: {
          p_amount: number
          p_description: string
          p_reference_id?: string
          p_type?: string
          p_user_id: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      institution_role: "institution_admin" | "teacher" | "student"
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
    Enums: {
      app_role: ["admin", "user"],
      institution_role: ["institution_admin", "teacher", "student"],
    },
  },
} as const
