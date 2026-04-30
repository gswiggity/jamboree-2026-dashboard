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
      allowed_emails: {
        Row: {
          email: string
          invited_at: string
          invited_by: string | null
        }
        Insert: {
          email: string
          invited_at?: string
          invited_by?: string | null
        }
        Update: {
          email?: string
          invited_at?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          created_at: string
          key: string
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          key: string
          kind: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          actual_cents: number | null
          category_key: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          incurred_at: string | null
          notes: string
          planned_cents: number
          updated_at: string
        }
        Insert: {
          actual_cents?: number | null
          category_key: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          incurred_at?: string | null
          notes?: string
          planned_cents: number
          updated_at?: string
        }
        Update: {
          actual_cents?: number | null
          category_key?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          incurred_at?: string | null
          notes?: string
          planned_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "budget_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          description: string
          file_name: string
          id: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          submission_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          file_name: string
          id?: string
          mime_type?: string
          name: string
          size_bytes?: number
          storage_path: string
          submission_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          file_name?: string
          id?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          submission_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submission_verdict_counts"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      festival_settings: {
        Row: {
          id: boolean
          phase: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          phase?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          phase?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festival_settings_phase_fkey"
            columns: ["phase"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "festival_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_integration: {
        Row: {
          account_email: string | null
          connected_at: string | null
          connected_by: string | null
          id: boolean
          last_used_at: string | null
          refresh_token: string | null
          scopes: string | null
          updated_at: string
        }
        Insert: {
          account_email?: string | null
          connected_at?: string | null
          connected_by?: string | null
          id?: boolean
          last_used_at?: string | null
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
        }
        Update: {
          account_email?: string | null
          connected_at?: string | null
          connected_by?: string | null
          id?: boolean
          last_used_at?: string | null
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_integration_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          file_name: string | null
          id: string
          new_rows: number
          row_count: number
          type: string
          updated_rows: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          new_rows?: number
          row_count?: number
          type: string
          updated_rows?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string | null
          id?: string
          new_rows?: number
          row_count?: number
          type?: string
          updated_rows?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      judgments: {
        Row: {
          created_at: string
          id: string
          notes: string
          submission_id: string
          updated_at: string
          user_id: string
          verdict: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          submission_id: string
          updated_at?: string
          user_id: string
          verdict?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          submission_id?: string
          updated_at?: string
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judgments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submission_verdict_counts"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "judgments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_cards: {
        Row: {
          column_id: string | null
          created_at: string
          id: string
          position: number
          set_length_minutes: number | null
          submission_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          column_id?: string | null
          created_at?: string
          id?: string
          position?: number
          set_length_minutes?: number | null
          submission_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          column_id?: string | null
          created_at?: string
          id?: string
          position?: number
          set_length_minutes?: number | null
          submission_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "lineup_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_cards_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submission_verdict_counts"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "lineup_cards_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_columns: {
        Row: {
          color: string | null
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          archived_at: string | null
          cost_cents: number
          created_at: string
          created_by: string | null
          ended_on: string | null
          id: string
          kind: string
          name: string
          notes: string
          started_on: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          cost_cents?: number
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string
          started_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          blurb: string
          created_at: string
          key: string
          label: string
          short: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          blurb?: string
          created_at?: string
          key: string
          label: string
          short: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          blurb?: string
          created_at?: string
          key?: string
          label?: string
          short?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
          verdicts_published: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
          verdicts_published?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          verdicts_published?: boolean
        }
        Relationships: []
      }
      programming_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          name: string
          published_at: string | null
          published_by: string | null
          updated_at: string
          venue_colors: Json
          venues: string[]
          window_end_time: string
          window_start_time: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          name: string
          published_at?: string | null
          published_by?: string | null
          updated_at?: string
          venue_colors?: Json
          venues?: string[]
          window_end_time?: string
          window_start_time?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          name?: string
          published_at?: string | null
          published_by?: string | null
          updated_at?: string
          venue_colors?: Json
          venues?: string[]
          window_end_time?: string
          window_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "programming_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programming_drafts_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      show_block_comments: {
        Row: {
          block_id: string
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          block_id: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          block_id?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_block_comments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "show_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_block_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      show_block_submissions: {
        Row: {
          block_id: string
          created_at: string
          duration_minutes: number | null
          position: number | null
          submission_id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          duration_minutes?: number | null
          position?: number | null
          submission_id: string
        }
        Update: {
          block_id?: string
          created_at?: string
          duration_minutes?: number | null
          position?: number | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_block_submissions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "show_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_block_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submission_verdict_counts"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "show_block_submissions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      show_blocks: {
        Row: {
          buffer_minutes: number
          created_at: string
          day: string
          draft_id: string
          end_time: string
          host: string | null
          id: string
          kind: string
          location: string | null
          notes: string | null
          start_time: string
          theme: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          day: string
          draft_id: string
          end_time: string
          host?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          start_time: string
          theme?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          day?: string
          draft_id?: string
          end_time?: string
          host?: string | null
          id?: string
          kind?: string
          location?: string | null
          notes?: string | null
          start_time?: string
          theme?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_blocks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "programming_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          email: string | null
          external_id: string
          id: string
          name: string | null
          source_import_id: string | null
          submitted_at: string | null
          supplemental_video_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          email?: string | null
          external_id: string
          id?: string
          name?: string | null
          source_import_id?: string | null
          submitted_at?: string | null
          supplemental_video_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          email?: string | null
          external_id?: string
          id?: string
          name?: string | null
          source_import_id?: string | null
          submitted_at?: string | null
          supplemental_video_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sales: {
        Row: {
          buyer_email: string
          buyer_name: string
          campaign_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          id: string
          notes: string
          quantity: number
          reference: string
          sold_at: string
          type_id: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          buyer_email?: string
          buyer_name?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          quantity: number
          reference?: string
          sold_at?: string
          type_id: string
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          buyer_email?: string
          buyer_name?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          quantity?: number
          reference?: string
          sold_at?: string
          type_id?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sales_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          archived_at: string | null
          capacity: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string
          on_date: string | null
          price_cents: number
          sort_order: number
          start_time: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string
          on_date?: string | null
          price_cents: number
          sort_order?: number
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string
          on_date?: string | null
          price_cents?: number
          sort_order?: number
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_roles: {
        Row: {
          created_at: string
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      volunteer_shift_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          shift_id: string
          volunteer_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          shift_id: string
          volunteer_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          shift_id?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_shift_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "volunteer_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_shift_assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "submission_verdict_counts"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "volunteer_shift_assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          end_time: string
          id: string
          location: string
          notes: string
          required_count: number
          role_key: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          end_time: string
          id?: string
          location?: string
          notes?: string
          required_count?: number
          role_key: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          end_time?: string
          id?: string
          location?: string
          notes?: string
          required_count?: number
          role_key?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_shifts_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "volunteer_roles"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      submission_verdict_counts: {
        Row: {
          maybe_count: number | null
          no_count: number | null
          submission_id: string | null
          total_judgments: number | null
          type: string | null
          yes_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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

