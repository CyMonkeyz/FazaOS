import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SoraModule =
  "Core" | "Money" | "Activity" | "Business" | "Review" | "Health" | "Integrations";

export type SoraSchemaEntry = {
  table: string;
  module: SoraModule;
  purpose: string;
  keyColumns: string[];
  relationships: string[];
  userOwned: boolean;
  sensitive: boolean | string[];
  implemented: boolean;
  commonQuestions: string[];
};

export type SoraDbClient = SupabaseClient<Database>;

export type SoraToolContext = {
  userId: string;
  supabase: SoraDbClient;
  rawUserText?: string;
  channel?: "web" | "telegram";
  conversationKey?: string;
};

export type SoraIntent =
  | "answer_question"
  | "get_schema_summary"
  | "get_today_summary"
  | "add_expense"
  | "add_income"
  | "add_task"
  | "add_agenda"
  | "add_debt"
  | "add_receivable"
  | "add_bill"
  | "add_workout_plan"
  | "complete_workout"
  | "skip_workout"
  | "add_body_metric"
  | "add_supplement_purchase"
  | "add_business"
  | "add_product"
  | "add_sale"
  | "update_stock"
  | "update_record"
  | "delete_record"
  | "analyze_money"
  | "analyze_business"
  | "analyze_activity"
  | "analyze_health"
  | "analyze_review"
  | "analyze_investment"
  | "generate_receivable_message"
  | "unknown";

export type SoraActionResult = {
  intent: SoraIntent;
  confidence: number;
  requiresConfirmation: boolean;
  module: SoraModule | "Unknown";
  data: Record<string, unknown>;
  reply: string;
  actionTaken?: boolean;
  status?: "parsed" | "executed" | "needs_confirmation" | "answered" | "failed";
};
