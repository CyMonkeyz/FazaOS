export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      academic_tasks: {
        Row: {
          completed_at: string | null;
          course_id: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          estimate_minutes: number | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          course_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimate_minutes?: number | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          course_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          estimate_minutes?: number | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_tasks_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_events: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          ends_at: string | null;
          gcal_event_id: string | null;
          gcal_synced_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["event_kind"];
          location: string | null;
          notes: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          ends_at?: string | null;
          gcal_event_id?: string | null;
          gcal_synced_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["event_kind"];
          location?: string | null;
          notes?: string | null;
          starts_at: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          ends_at?: string | null;
          gcal_event_id?: string | null;
          gcal_synced_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["event_kind"];
          location?: string | null;
          notes?: string | null;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          acquisition_date: string | null;
          asset_type: Database["public"]["Enums"]["asset_type"];
          created_at: string | null;
          current_value: number;
          deleted_at: string | null;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          acquisition_date?: string | null;
          asset_type?: Database["public"]["Enums"]["asset_type"];
          created_at?: string | null;
          current_value?: number;
          deleted_at?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          acquisition_date?: string | null;
          asset_type?: Database["public"]["Enums"]["asset_type"];
          created_at?: string | null;
          current_value?: number;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          amount: number;
          bill_type: Database["public"]["Enums"]["bill_type"] | null;
          category: string | null;
          created_at: string | null;
          deleted_at: string | null;
          due_date: string;
          id: string;
          name: string;
          notes: string | null;
          recurrence: string | null;
          reminder_enabled: boolean | null;
          status: Database["public"]["Enums"]["bill_status"];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          bill_type?: Database["public"]["Enums"]["bill_type"] | null;
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          due_date: string;
          id?: string;
          name: string;
          notes?: string | null;
          recurrence?: string | null;
          reminder_enabled?: boolean | null;
          status?: Database["public"]["Enums"]["bill_status"];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          bill_type?: Database["public"]["Enums"]["bill_type"] | null;
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          recurrence?: string | null;
          reminder_enabled?: boolean | null;
          status?: Database["public"]["Enums"]["bill_status"];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      body_metrics: {
        Row: {
          arm_cm: number | null;
          body_fat_percentage: number | null;
          chest_cm: number | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metric_date: string;
          notes: string | null;
          sleep_hours: number | null;
          sleep_quality: number | null;
          steps: number | null;
          thigh_cm: number | null;
          updated_at: string;
          user_id: string;
          waist_cm: number | null;
          water_liters: number | null;
          weight_kg: number | null;
        };
        Insert: {
          arm_cm?: number | null;
          body_fat_percentage?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metric_date?: string;
          notes?: string | null;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          steps?: number | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id: string;
          waist_cm?: number | null;
          water_liters?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          arm_cm?: number | null;
          body_fat_percentage?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metric_date?: string;
          notes?: string | null;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          steps?: number | null;
          thigh_cm?: number | null;
          updated_at?: string;
          user_id?: string;
          waist_cm?: number | null;
          water_liters?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          deleted_at: string | null;
          end_date: string | null;
          id: string;
          name: string;
          notes: string | null;
          period_type: Database["public"]["Enums"]["budget_period"];
          planned_amount: number;
          start_date: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          period_type?: Database["public"]["Enums"]["budget_period"];
          planned_amount: number;
          start_date: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          period_type?: Database["public"]["Enums"]["budget_period"];
          planned_amount?: number;
          start_date?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "money_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      competitions: {
        Row: {
          category: string | null;
          created_at: string;
          deleted_at: string | null;
          event_date: string | null;
          id: string;
          name: string;
          notes: string | null;
          organizer: string | null;
          registration_deadline: string | null;
          result: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          event_date?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          organizer?: string | null;
          registration_deadline?: string | null;
          result?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          event_date?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          organizer?: string | null;
          registration_deadline?: string | null;
          result?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          code: string | null;
          color: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          lecturer: string | null;
          name: string;
          notes: string | null;
          semester: string | null;
          sks: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          code?: string | null;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lecturer?: string | null;
          name: string;
          notes?: string | null;
          semester?: string | null;
          sks?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          code?: string | null;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lecturer?: string | null;
          name?: string;
          notes?: string | null;
          semester?: string | null;
          sks?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      daily_logs: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          energy: number | null;
          focus: number | null;
          gratitude: string | null;
          id: string;
          log_date: string;
          mood: number | null;
          struggles: string | null;
          tomorrow_focus: string | null;
          updated_at: string;
          user_id: string;
          wins: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          energy?: number | null;
          focus?: number | null;
          gratitude?: string | null;
          id?: string;
          log_date?: string;
          mood?: number | null;
          struggles?: string | null;
          tomorrow_focus?: string | null;
          updated_at?: string;
          user_id: string;
          wins?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          energy?: number | null;
          focus?: number | null;
          gratitude?: string | null;
          id?: string;
          log_date?: string;
          mood?: number | null;
          struggles?: string | null;
          tomorrow_focus?: string | null;
          updated_at?: string;
          user_id?: string;
          wins?: string | null;
        };
        Relationships: [];
      };
      debt_payments: {
        Row: {
          amount: number;
          created_at: string | null;
          debt_id: string;
          deleted_at: string | null;
          id: string;
          method: string | null;
          note: string | null;
          payment_date: string;
          proof_file_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          debt_id: string;
          deleted_at?: string | null;
          id?: string;
          method?: string | null;
          note?: string | null;
          payment_date?: string;
          proof_file_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          debt_id?: string;
          deleted_at?: string | null;
          id?: string;
          method?: string | null;
          note?: string | null;
          payment_date?: string;
          proof_file_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey";
            columns: ["debt_id"];
            isOneToOne: false;
            referencedRelation: "debts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debt_payments_proof_file_id_fkey";
            columns: ["proof_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      debts: {
        Row: {
          amount: number;
          borrowed_date: string;
          created_at: string | null;
          deleted_at: string | null;
          due_date: string | null;
          id: string;
          installment_amount: number | null;
          lender_name: string;
          notes: string | null;
          payment_frequency: string | null;
          priority: Database["public"]["Enums"]["priority_level"] | null;
          proof_file_id: string | null;
          remaining_balance: number;
          risk_level: string | null;
          status: Database["public"]["Enums"]["debt_status"];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          borrowed_date?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          installment_amount?: number | null;
          lender_name: string;
          notes?: string | null;
          payment_frequency?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          proof_file_id?: string | null;
          remaining_balance: number;
          risk_level?: string | null;
          status?: Database["public"]["Enums"]["debt_status"];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          borrowed_date?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          installment_amount?: number | null;
          lender_name?: string;
          notes?: string | null;
          payment_frequency?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"] | null;
          proof_file_id?: string | null;
          remaining_balance?: number;
          risk_level?: string | null;
          status?: Database["public"]["Enums"]["debt_status"];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debts_proof_file_id_fkey";
            columns: ["proof_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_library: {
        Row: {
          category: string | null;
          created_at: string;
          default_duration_seconds: number | null;
          default_reps: number | null;
          default_sets: number | null;
          deleted_at: string | null;
          equipment: string | null;
          id: string;
          muscle_group: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          default_duration_seconds?: number | null;
          default_reps?: number | null;
          default_sets?: number | null;
          deleted_at?: string | null;
          equipment?: string | null;
          id?: string;
          muscle_group?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          default_duration_seconds?: number | null;
          default_reps?: number | null;
          default_sets?: number | null;
          deleted_at?: string | null;
          equipment?: string | null;
          id?: string;
          muscle_group?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          category: string | null;
          created_at: string | null;
          deleted_at: string | null;
          file_name: string | null;
          id: string;
          is_private: boolean | null;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          file_name?: string | null;
          id?: string;
          is_private?: boolean | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          file_name?: string | null;
          id?: string;
          is_private?: boolean | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          area: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          progress: number;
          status: string;
          target_date: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          area?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          progress?: number;
          status?: string;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          area?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          progress?: number;
          status?: string;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      garden_events: {
        Row: {
          created_at: string;
          event_date: string;
          id: string;
          metadata: Json;
          points: number;
          season_id: string;
          source_key: string;
          source_type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_date?: string;
          id?: string;
          metadata?: Json;
          points: number;
          season_id: string;
          source_key: string;
          source_type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_date?: string;
          id?: string;
          metadata?: Json;
          points?: number;
          season_id?: string;
          source_key?: string;
          source_type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      garden_seasons: {
        Row: {
          archived_at: string | null;
          best_streak: number;
          created_at: string;
          final_snapshot: Json;
          id: string;
          score: number;
          season_month: string;
          stage: string;
          status: string;
          updated_at: string;
          user_id: string;
          vitality: number;
        };
        Insert: {
          archived_at?: string | null;
          best_streak?: number;
          created_at?: string;
          final_snapshot?: Json;
          id?: string;
          score?: number;
          season_month: string;
          stage?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          vitality?: number;
        };
        Update: {
          archived_at?: string | null;
          best_streak?: number;
          created_at?: string;
          final_snapshot?: Json;
          id?: string;
          score?: number;
          season_month?: string;
          stage?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          vitality?: number;
        };
        Relationships: [];
      };
      habit_logs: {
        Row: {
          completed_at: string;
          created_at: string;
          habit_id: string;
          id: string;
          log_date: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          created_at?: string;
          habit_id: string;
          id?: string;
          log_date?: string;
          note?: string | null;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          created_at?: string;
          habit_id?: string;
          id?: string;
          log_date?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          color: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          icon: string;
          id: string;
          is_active: boolean;
          name: string;
          reminder_enabled: boolean;
          reminder_time: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string;
          weekdays: number[];
        };
        Insert: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          reminder_enabled?: boolean;
          reminder_time?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
          weekdays?: number[];
        };
        Update: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          reminder_enabled?: boolean;
          reminder_time?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Relationships: [];
      };
      investments: {
        Row: {
          avg_buy_price: number;
          created_at: string;
          currency: string;
          current_price: number;
          deleted_at: string | null;
          id: string;
          last_updated_at: string;
          name: string;
          notes: string | null;
          quantity: number;
          ticker: string | null;
          type: Database["public"]["Enums"]["investment_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avg_buy_price?: number;
          created_at?: string;
          currency?: string;
          current_price?: number;
          deleted_at?: string | null;
          id?: string;
          last_updated_at?: string;
          name: string;
          notes?: string | null;
          quantity?: number;
          ticker?: string | null;
          type?: Database["public"]["Enums"]["investment_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avg_buy_price?: number;
          created_at?: string;
          currency?: string;
          current_price?: number;
          deleted_at?: string | null;
          id?: string;
          last_updated_at?: string;
          name?: string;
          notes?: string | null;
          quantity?: number;
          ticker?: string | null;
          type?: Database["public"]["Enums"]["investment_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      money_accounts: {
        Row: {
          account_type: string;
          created_at: string | null;
          currency: string | null;
          deleted_at: string | null;
          id: string;
          initial_balance: number | null;
          name: string;
          notes: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_type?: string;
          created_at?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          id?: string;
          initial_balance?: number | null;
          name: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_type?: string;
          created_at?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          id?: string;
          initial_balance?: number | null;
          name?: string;
          notes?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      money_categories: {
        Row: {
          color: string | null;
          created_at: string | null;
          deleted_at: string | null;
          icon: string | null;
          id: string;
          is_required: boolean | null;
          kind: Database["public"]["Enums"]["txn_type"];
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          icon?: string | null;
          id?: string;
          is_required?: boolean | null;
          kind: Database["public"]["Enums"]["txn_type"];
          name: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          icon?: string | null;
          id?: string;
          is_required?: boolean | null;
          kind?: Database["public"]["Enums"]["txn_type"];
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          body: string | null;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          tags: string[] | null;
          title: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          tags?: string[] | null;
          title?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          tags?: string[] | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          channel: string;
          created_at: string;
          dedupe_key: string;
          error_message: string | null;
          id: string;
          message: string | null;
          priority: string | null;
          related_id: string | null;
          related_table: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string;
          title: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          dedupe_key: string;
          error_message?: string | null;
          id?: string;
          message?: string | null;
          priority?: string | null;
          related_id?: string | null;
          related_table?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          title?: string | null;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          dedupe_key?: string;
          error_message?: string | null;
          id?: string;
          message?: string | null;
          priority?: string | null;
          related_id?: string | null;
          related_table?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          title?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      org_meetings: {
        Row: {
          agenda: string | null;
          created_at: string;
          deleted_at: string | null;
          ends_at: string | null;
          id: string;
          location: string | null;
          notes: string | null;
          organization_id: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agenda?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          starts_at: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agenda?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          ends_at?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_meetings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          ended_on: string | null;
          id: string;
          kind: string | null;
          name: string;
          notes: string | null;
          role: string | null;
          started_on: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          ended_on?: string | null;
          id?: string;
          kind?: string | null;
          name: string;
          notes?: string | null;
          role?: string | null;
          started_on?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          ended_on?: string | null;
          id?: string;
          kind?: string | null;
          name?: string;
          notes?: string | null;
          role?: string | null;
          started_on?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      portfolio_items: {
        Row: {
          created_at: string;
          date_on: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          kind: string | null;
          link: string | null;
          role: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date_on?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          kind?: string | null;
          link?: string | null;
          role?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date_on?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          kind?: string | null;
          link?: string | null;
          role?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          business_id: string | null;
          created_at: string;
          deleted_at: string | null;
          hpp: number;
          id: string;
          min_stock: number;
          name: string;
          notes: string | null;
          price: number;
          sku: string | null;
          stock: number;
          supplier_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          business_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          hpp?: number;
          id?: string;
          min_stock?: number;
          name: string;
          notes?: string | null;
          price?: number;
          sku?: string | null;
          stock?: number;
          supplier_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          business_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          hpp?: number;
          id?: string;
          min_stock?: number;
          name?: string;
          notes?: string | null;
          price?: number;
          sku?: string | null;
          stock?: number;
          supplier_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          currency: string | null;
          display_name: string | null;
          id: string;
          onboarded: boolean | null;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          currency?: string | null;
          display_name?: string | null;
          id: string;
          onboarded?: boolean | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          currency?: string | null;
          display_name?: string | null;
          id?: string;
          onboarded?: boolean | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      receivable_payments: {
        Row: {
          amount: number;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          method: string | null;
          note: string | null;
          proof_file_id: string | null;
          receivable_id: string;
          received_date: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          method?: string | null;
          note?: string | null;
          proof_file_id?: string | null;
          receivable_id: string;
          received_date?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          method?: string | null;
          note?: string | null;
          proof_file_id?: string | null;
          receivable_id?: string;
          received_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receivable_payments_proof_file_id_fkey";
            columns: ["proof_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receivable_payments_receivable_id_fkey";
            columns: ["receivable_id"];
            isOneToOne: false;
            referencedRelation: "receivables";
            referencedColumns: ["id"];
          },
        ];
      };
      receivables: {
        Row: {
          amount: number;
          amount_paid: number;
          borrower_name: string;
          chat_proof_file_id: string | null;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          lent_date: string;
          notes: string | null;
          promised_payment_date: string | null;
          relationship: string | null;
          remaining_amount: number;
          risk_level: string | null;
          status: Database["public"]["Enums"]["receivable_status"];
          transfer_proof_file_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          amount_paid?: number;
          borrower_name: string;
          chat_proof_file_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          lent_date?: string;
          notes?: string | null;
          promised_payment_date?: string | null;
          relationship?: string | null;
          remaining_amount: number;
          risk_level?: string | null;
          status?: Database["public"]["Enums"]["receivable_status"];
          transfer_proof_file_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          amount_paid?: number;
          borrower_name?: string;
          chat_proof_file_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          lent_date?: string;
          notes?: string | null;
          promised_payment_date?: string | null;
          relationship?: string | null;
          remaining_amount?: number;
          risk_level?: string | null;
          status?: Database["public"]["Enums"]["receivable_status"];
          transfer_proof_file_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receivables_chat_proof_file_id_fkey";
            columns: ["chat_proof_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receivables_transfer_proof_file_id_fkey";
            columns: ["transfer_proof_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          business_id: string | null;
          channel: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          product_id: string | null;
          product_name: string;
          profit: number;
          quantity: number;
          sold_at: string;
          total: number;
          unit_hpp: number;
          unit_price: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          business_id?: string | null;
          channel?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          product_id?: string | null;
          product_name: string;
          profit?: number;
          quantity: number;
          sold_at?: string;
          total: number;
          unit_hpp?: number;
          unit_price: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          business_id?: string | null;
          channel?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          product_id?: string | null;
          product_name?: string;
          profit?: number;
          quantity?: number;
          sold_at?: string;
          total?: number;
          unit_hpp?: number;
          unit_price?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sora_action_logs: {
        Row: {
          action_taken: boolean;
          completion_tokens: number | null;
          confidence: number | null;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          input_text: string | null;
          intent: string | null;
          model: string | null;
          parsed_data: Json | null;
          prompt_tokens: number | null;
          requires_confirmation: boolean;
          source: string;
          status: string | null;
          user_id: string;
        };
        Insert: {
          action_taken?: boolean;
          completion_tokens?: number | null;
          confidence?: number | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          input_text?: string | null;
          intent?: string | null;
          model?: string | null;
          parsed_data?: Json | null;
          prompt_tokens?: number | null;
          requires_confirmation?: boolean;
          source?: string;
          status?: string | null;
          user_id: string;
        };
        Update: {
          action_taken?: boolean;
          completion_tokens?: number | null;
          confidence?: number | null;
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          input_text?: string | null;
          intent?: string | null;
          model?: string | null;
          parsed_data?: Json | null;
          prompt_tokens?: number | null;
          requires_confirmation?: boolean;
          source?: string;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      sora_pending_actions: {
        Row: {
          action_type: string;
          challenge: string;
          channel: string;
          confirmation_step: number;
          conversation_key: string;
          created_at: string;
          expires_at: string;
          id: string;
          payload: Json;
          status: string;
          target_id: string;
          target_label: string;
          target_table: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action_type: string;
          challenge: string;
          channel: string;
          confirmation_step?: number;
          conversation_key?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload?: Json;
          status?: string;
          target_id: string;
          target_label: string;
          target_table: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          action_type?: string;
          challenge?: string;
          channel?: string;
          confirmation_step?: number;
          conversation_key?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload?: Json;
          status?: string;
          target_id?: string;
          target_label?: string;
          target_table?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sora_telegram_sessions: {
        Row: {
          chat_id: string;
          created_at: string;
          id: string;
          last_intent: string | null;
          pending_action: Json | null;
          pending_action_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chat_id: string;
          created_at?: string;
          id?: string;
          last_intent?: string | null;
          pending_action?: Json | null;
          pending_action_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chat_id?: string;
          created_at?: string;
          id?: string;
          last_intent?: string | null;
          pending_action?: Json | null;
          pending_action_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          business_id: string | null;
          contact: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          notes: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          business_id?: string | null;
          contact?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          business_id?: string | null;
          contact?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          color: string | null;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      telegram_jobs: {
        Row: {
          attempts: number;
          chat_id: string;
          created_at: string;
          finished_at: string | null;
          id: string;
          job_type: string;
          last_error: string | null;
          payload: Json;
          scheduled_at: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          attempts?: number;
          chat_id: string;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type: string;
          last_error?: string | null;
          payload?: Json;
          scheduled_at?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          attempts?: number;
          chat_id?: string;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type?: string;
          last_error?: string | null;
          payload?: Json;
          scheduled_at?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      telegram_message_logs: {
        Row: {
          chat_id: number | null;
          created_at: string;
          direction: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          message_text: string | null;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          chat_id?: number | null;
          created_at?: string;
          direction: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          message_text?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          chat_id?: number | null;
          created_at?: string;
          direction?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          message_text?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      telegram_update_dedupes: {
        Row: {
          chat_id: string | null;
          id: string;
          received_at: string;
          update_id: string;
        };
        Insert: {
          chat_id?: string | null;
          id?: string;
          received_at?: string;
          update_id: string;
        };
        Update: {
          chat_id?: string | null;
          id?: string;
          received_at?: string;
          update_id?: string;
        };
        Relationships: [];
      };
      telegram_users: {
        Row: {
          chat_id: number | null;
          created_at: string;
          link_code: string | null;
          link_code_expires_at: string | null;
          linked_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chat_id?: number | null;
          created_at?: string;
          link_code?: string | null;
          link_code_expires_at?: string | null;
          linked_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chat_id?: number | null;
          created_at?: string;
          link_code?: string | null;
          link_code_expires_at?: string | null;
          linked_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          account_id: string | null;
          amount: number;
          attachment_file_id: string | null;
          category_id: string | null;
          created_at: string | null;
          date: string;
          deleted_at: string | null;
          id: string;
          is_productive: boolean | null;
          is_required: boolean | null;
          note: string | null;
          payment_method: string | null;
          tags: string[] | null;
          type: Database["public"]["Enums"]["txn_type"];
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          attachment_file_id?: string | null;
          category_id?: string | null;
          created_at?: string | null;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          is_productive?: boolean | null;
          is_required?: boolean | null;
          note?: string | null;
          payment_method?: string | null;
          tags?: string[] | null;
          type: Database["public"]["Enums"]["txn_type"];
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          attachment_file_id?: string | null;
          category_id?: string | null;
          created_at?: string | null;
          date?: string;
          deleted_at?: string | null;
          id?: string;
          is_productive?: boolean | null;
          is_required?: boolean | null;
          note?: string | null;
          payment_method?: string | null;
          tags?: string[] | null;
          type?: Database["public"]["Enums"]["txn_type"];
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "money_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_attachment_file_id_fkey";
            columns: ["attachment_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "money_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          created_at: string | null;
          hide_amounts: boolean | null;
          id: string;
          locale: string | null;
          notify_bill_due: boolean;
          notify_daily_digest: boolean;
          notify_deadline: boolean | null;
          notify_debt_due: boolean | null;
          notify_habits: boolean;
          notify_midday_check: boolean | null;
          notify_morning_brief: boolean | null;
          notify_night_review: boolean | null;
          notify_receivable_due: boolean | null;
          notify_task_due: boolean;
          notify_workout: boolean | null;
          quiet_hours_enabled: boolean | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          selected_business_id: string | null;
          show_amounts_in_telegram: boolean | null;
          telegram_chat_id: string | null;
          telegram_enabled: boolean;
          theme: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          hide_amounts?: boolean | null;
          id?: string;
          locale?: string | null;
          notify_bill_due?: boolean;
          notify_daily_digest?: boolean;
          notify_deadline?: boolean | null;
          notify_debt_due?: boolean | null;
          notify_habits?: boolean;
          notify_midday_check?: boolean | null;
          notify_morning_brief?: boolean | null;
          notify_night_review?: boolean | null;
          notify_receivable_due?: boolean | null;
          notify_task_due?: boolean;
          notify_workout?: boolean | null;
          quiet_hours_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          selected_business_id?: string | null;
          show_amounts_in_telegram?: boolean | null;
          telegram_chat_id?: string | null;
          telegram_enabled?: boolean;
          theme?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          hide_amounts?: boolean | null;
          id?: string;
          locale?: string | null;
          notify_bill_due?: boolean;
          notify_daily_digest?: boolean;
          notify_deadline?: boolean | null;
          notify_debt_due?: boolean | null;
          notify_habits?: boolean;
          notify_midday_check?: boolean | null;
          notify_morning_brief?: boolean | null;
          notify_night_review?: boolean | null;
          notify_receivable_due?: boolean | null;
          notify_task_due?: boolean;
          notify_workout?: boolean | null;
          quiet_hours_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          selected_business_id?: string | null;
          show_amounts_in_telegram?: boolean | null;
          telegram_chat_id?: string | null;
          telegram_enabled?: boolean;
          theme?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_selected_business_id_fkey";
            columns: ["selected_business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          highlights: string | null;
          id: string;
          lessons: string | null;
          next_week_focus: string | null;
          score_academic: number | null;
          score_business: number | null;
          score_health: number | null;
          score_money: number | null;
          score_organization: number | null;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          highlights?: string | null;
          id?: string;
          lessons?: string | null;
          next_week_focus?: string | null;
          score_academic?: number | null;
          score_business?: number | null;
          score_health?: number | null;
          score_money?: number | null;
          score_organization?: number | null;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          highlights?: string | null;
          id?: string;
          lessons?: string | null;
          next_week_focus?: string | null;
          score_academic?: number | null;
          score_business?: number | null;
          score_health?: number | null;
          score_money?: number | null;
          score_organization?: number | null;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          calories_estimated: number | null;
          created_at: string;
          deleted_at: string | null;
          duration_minutes: number | null;
          energy_after: number | null;
          energy_before: number | null;
          id: string;
          intensity: string | null;
          mood_after: number | null;
          mood_before: number | null;
          notes: string | null;
          updated_at: string;
          user_id: string;
          workout_date: string;
          workout_plan_id: string | null;
          workout_type: string;
        };
        Insert: {
          calories_estimated?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          energy_after?: number | null;
          energy_before?: number | null;
          id?: string;
          intensity?: string | null;
          mood_after?: number | null;
          mood_before?: number | null;
          notes?: string | null;
          updated_at?: string;
          user_id: string;
          workout_date?: string;
          workout_plan_id?: string | null;
          workout_type: string;
        };
        Update: {
          calories_estimated?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_minutes?: number | null;
          energy_after?: number | null;
          energy_before?: number | null;
          id?: string;
          intensity?: string | null;
          mood_after?: number | null;
          mood_before?: number | null;
          notes?: string | null;
          updated_at?: string;
          user_id?: string;
          workout_date?: string;
          workout_plan_id?: string | null;
          workout_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_logs_workout_plan_id_fkey";
            columns: ["workout_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_plans: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          status: string;
          target_duration_minutes: number | null;
          target_intensity: string | null;
          title: string;
          updated_at: string;
          user_id: string;
          workout_date: string;
          workout_time: string | null;
          workout_type: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          target_duration_minutes?: number | null;
          target_intensity?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
          workout_date: string;
          workout_time?: string | null;
          workout_type: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          target_duration_minutes?: number | null;
          target_intensity?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workout_date?: string;
          workout_time?: string | null;
          workout_type?: string;
        };
        Relationships: [];
      };
      workout_sets: {
        Row: {
          created_at: string;
          distance_km: number | null;
          duration_seconds: number | null;
          exercise_id: string | null;
          id: string;
          notes: string | null;
          reps: number | null;
          rest_seconds: number | null;
          set_number: number;
          updated_at: string;
          user_id: string;
          weight: number | null;
          workout_log_id: string;
        };
        Insert: {
          created_at?: string;
          distance_km?: number | null;
          duration_seconds?: number | null;
          exercise_id?: string | null;
          id?: string;
          notes?: string | null;
          reps?: number | null;
          rest_seconds?: number | null;
          set_number: number;
          updated_at?: string;
          user_id: string;
          weight?: number | null;
          workout_log_id: string;
        };
        Update: {
          created_at?: string;
          distance_km?: number | null;
          duration_seconds?: number | null;
          exercise_id?: string | null;
          id?: string;
          notes?: string | null;
          reps?: number | null;
          rest_seconds?: number | null;
          set_number?: number;
          updated_at?: string;
          user_id?: string;
          weight?: number | null;
          workout_log_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercise_library";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sets_workout_log_id_fkey";
            columns: ["workout_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_logs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ensure_garden_season: {
        Args: { p_date?: string; p_user_id: string };
        Returns: string;
      };
      refresh_garden_season: {
        Args: { p_date?: string; p_user_id: string };
        Returns: undefined;
      };
      refresh_habit_garden_day: {
        Args: { p_date: string; p_user_id: string };
        Returns: undefined;
      };
      run_garden_maintenance: {
        Args: { p_date?: string };
        Returns: number;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      asset_type:
        | "cash"
        | "savings"
        | "gold"
        | "investment"
        | "business_equipment"
        | "productive_asset"
        | "other";
      bill_status: "upcoming" | "paid" | "overdue" | "cancelled";
      bill_type:
        | "credit_card"
        | "subscription"
        | "installment"
        | "annual_fee"
        | "internet"
        | "software"
        | "domain"
        | "hosting"
        | "other";
      budget_period: "daily" | "weekly" | "monthly";
      debt_status: "active" | "installment" | "paid" | "overdue" | "problematic" | "cancelled";
      event_kind: "class" | "meeting" | "deadline" | "personal" | "other";
      investment_type:
        | "saham"
        | "crypto"
        | "obligasi"
        | "reksadana"
        | "p2p"
        | "emas"
        | "deposito"
        | "forex"
        | "other";
      priority_level: "low" | "medium" | "high" | "urgent";
      receivable_status:
        | "active"
        | "waiting_payment"
        | "installment"
        | "paid"
        | "overdue"
        | "hard_to_collect"
        | "forgiven"
        | "problematic";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "todo" | "in_progress" | "done" | "revision";
      txn_type: "income" | "expense";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      asset_type: [
        "cash",
        "savings",
        "gold",
        "investment",
        "business_equipment",
        "productive_asset",
        "other",
      ],
      bill_status: ["upcoming", "paid", "overdue", "cancelled"],
      bill_type: [
        "credit_card",
        "subscription",
        "installment",
        "annual_fee",
        "internet",
        "software",
        "domain",
        "hosting",
        "other",
      ],
      budget_period: ["daily", "weekly", "monthly"],
      debt_status: ["active", "installment", "paid", "overdue", "problematic", "cancelled"],
      event_kind: ["class", "meeting", "deadline", "personal", "other"],
      investment_type: [
        "saham",
        "crypto",
        "obligasi",
        "reksadana",
        "p2p",
        "emas",
        "deposito",
        "forex",
        "other",
      ],
      priority_level: ["low", "medium", "high", "urgent"],
      receivable_status: [
        "active",
        "waiting_payment",
        "installment",
        "paid",
        "overdue",
        "hard_to_collect",
        "forgiven",
        "problematic",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "revision"],
      txn_type: ["income", "expense"],
    },
  },
} as const;
