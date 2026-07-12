// Central query key map. Use functions for keys that depend on IDs.
// Refetch intervals are declared where the query is defined (per useQuery call);
// this file only guarantees stable keys and easy invalidation.

export const queryKeys = {
  home: {
    summary: ["home-summary"] as const,
    todayFocus: ["home-today-focus"] as const,
    workout: ["home-workout"] as const,
    telegram: ["home-telegram-status"] as const,
  },
  money: {
    overview: ["money-overview"] as const,
    transactions: ["transactions"] as const,
    debts: ["debts"] as const,
    receivables: ["receivables"] as const,
    bills: ["bills"] as const,
    budgets: ["budgets"] as const,
    investments: ["investments"] as const,
    assets: ["assets"] as const,
    accounts: ["money-accounts-full"] as const,
  },
  activity: {
    tasks: ["academic_tasks"] as const,
    events: ["activity_events"] as const,
    orgs: ["organizations"] as const,
    portfolio: ["portfolio_items"] as const,
    competitions: ["competitions"] as const,
    courses: ["courses"] as const,
  },
  business: {
    list: ["businesses"] as const,
    selected: ["selected-business"] as const,
    overview: (id: string | null) => ["business-overview", id ?? "all"] as const,
    sheets: (id: string | null) => ["business-sheet-dashboard", id ?? "none"] as const,
    products: (id: string | null) => ["business-products", id ?? "all"] as const,
    sales: (id: string | null) => ["business-sales", id ?? "all"] as const,
    suppliers: (id: string | null) => ["business-suppliers", id ?? "all"] as const,
  },
  review: {
    workoutPlans: ["workout_plans"] as const,
    workoutLogs: ["workout_logs"] as const,
    body: ["body_metrics"] as const,
    daily: ["daily_logs"] as const,
    weekly: ["weekly_reviews"] as const,
    goals: ["goals"] as const,
    habits: ["habits-garden"] as const,
    garden: ["home-garden"] as const,
  },
  telegram: {
    status: ["telegram-status"] as const,
    integrations: ["integration-status"] as const,
    notifPrefs: ["notif-prefs"] as const,
    jobs: ["telegram-jobs"] as const,
    logs: ["telegram-message-logs"] as const,
    schedules: ["scheduled-messages"] as const,
  },
  sora: { memories: ["sora-profile-memory"] as const },
};
