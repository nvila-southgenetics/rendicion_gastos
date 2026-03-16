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
      expenses: {
        Row: {
          admin_notes: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string | null
          currency: string | null
          description: string
          expense_date: string
          id: string
          n8n_processed: boolean | null
          n8n_raw_data: Json | null
          ocr_extracted_text: string | null
          merchant_name: string | null
          rejection_reason: string | null
          report_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          supervisor_comment: string | null
          employee_response: string | null
          ticket_storage_path: string | null
          ticket_url: string | null
          ticket_urls: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          currency?: string | null
          description: string
          expense_date: string
          id?: string
          n8n_processed?: boolean | null
          n8n_raw_data?: Json | null
          ocr_extracted_text?: string | null
          merchant_name?: string | null
          rejection_reason?: string | null
          report_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          supervisor_comment?: string | null
          employee_response?: string | null
          ticket_storage_path?: string | null
          ticket_url?: string | null
          ticket_urls?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string | null
          currency?: string | null
          description?: string
          expense_date?: string
          id?: string
          n8n_processed?: boolean | null
          n8n_raw_data?: Json | null
          ocr_extracted_text?: string | null
          merchant_name?: string | null
          rejection_reason?: string | null
          report_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          supervisor_comment?: string | null
          employee_response?: string | null
          ticket_storage_path?: string | null
          ticket_url?: string | null
          ticket_urls?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_presets: {
        Row: {
          currency:   string
          rate:       number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          currency:   string
          rate:       number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          currency?:   string
          rate?:       number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      supervision_assignments: {
        Row: {
          id:            string
          supervisor_id: string
          employee_id:   string
          assigned_by:   string | null
          created_at:    string
        }
        Insert: {
          id?:            string
          supervisor_id:  string
          employee_id:    string
          assigned_by?:   string | null
          created_at?:    string
        }
        Update: {
          id?:            string
          supervisor_id?: string
          employee_id?:   string
          assigned_by?:   string | null
          created_at?:    string
        }
        Relationships: [
          {
            foreignKeyName: "supervision_assignments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervision_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_webhooks_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          expense_id: string | null
          id: string
          response_data: Json | null
          status: string | null
          webhook_payload: Json | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          expense_id?: string | null
          id?: string
          response_data?: Json | null
          status?: string | null
          webhook_payload?: Json | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          expense_id?: string | null
          id?: string
          response_data?: Json | null
          status?: string | null
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_webhooks_log_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          related_expense_id: string | null
          related_report_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          related_expense_id?: string | null
          related_report_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          related_expense_id?: string | null
          related_report_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_expense_id_fkey"
            columns: ["related_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_report_id_fkey"
            columns: ["related_report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          country: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          country?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          country?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      viewer_assignments: {
        Row: {
          id: string
          viewer_id: string
          employee_id: string
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          viewer_id: string
          employee_id: string
          assigned_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          viewer_id?: string
          employee_id?: string
          assigned_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewer_assignments_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewer_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          budget_max: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          exchange_rates: Record<string, number> | null
          id: string
          notes: string | null
          title: string | null
          status: Database["public"]["Enums"]["report_status"]
          total_amount: number | null
          updated_at: string | null
          user_id: string
          week_end: string
          week_start: string
          workflow_status: string | null
          payment_receipt_url: string | null
          payment_date: string | null
          amount_paid: number | null
          payment_destination: string | null
        }
        Insert: {
          budget_max?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          exchange_rates?: Record<string, number> | null
          id?: string
          notes?: string | null
          title?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
          week_end: string
          week_start: string
          workflow_status?: string | null
          payment_receipt_url?: string | null
          payment_date?: string | null
          amount_paid?: number | null
          payment_destination?: string | null
        }
        Update: {
          budget_max?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          exchange_rates?: Record<string, number> | null
          id?: string
          notes?: string | null
          title?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
          week_end?: string
          week_start?: string
          workflow_status?: string | null
          payment_receipt_url?: string | null
          payment_date?: string | null
          amount_paid?: number | null
          payment_destination?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      expense_category:
        | "transport"
        | "food"
        | "accommodation"
        | "communication"
        | "office_supplies"
        | "entertainment"
        | "fuel"
        | "other"
      expense_status: "pending" | "approved" | "rejected" | "reviewing"
      report_status: "open" | "closed"
      user_role:
        | "admin"
        | "employee"
        | "seller"
        | "supervisor"
        | "aprobador"
        | "pagador"
        | "chusmas"
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
      expense_category: [
        "transport",
        "food",
        "accommodation",
        "communication",
        "office_supplies",
        "entertainment",
        "fuel",
        "other",
      ],
      expense_status: ["pending", "approved", "rejected", "reviewing"],
      report_status: ["open", "closed"],
      user_role: [
        "admin",
        "employee",
        "seller",
        "supervisor",
        "aprobador",
        "pagador",
        "chusmas",
      ],
    },
  },
} as const
