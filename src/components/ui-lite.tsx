import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Inbox, Loader2 } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className={cn("mt-1.5 text-xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function WarningCard({
  title,
  children,
  tone = "warning",
}: {
  title: string;
  children?: ReactNode;
  tone?: "warning" | "danger" | "info";
}) {
  const map = {
    warning: {
      bg: "bg-warning/10 border-warning/30 text-warning-foreground",
      icon: AlertTriangle,
      iconClass: "text-warning",
    },
    danger: {
      bg: "bg-destructive/10 border-destructive/30",
      icon: AlertTriangle,
      iconClass: "text-destructive",
    },
    info: { bg: "bg-accent/10 border-accent/30", icon: Info, iconClass: "text-accent" },
  }[tone];
  const Icon = map.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", map.bg)}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", map.iconClass)} />
      <div>
        <div className="font-medium">{title}</div>
        {children && <div className="mt-0.5 text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

/**
 * Progress bar loader — indeterminate animated bar with fake percentage.
 * Used for slow async ops (Telegram send, digest push) so user sees progress.
 */
export function ProgressLoader({
  label = "Memproses…",
  active,
  durationMs = 8000,
}: {
  label?: string;
  active: boolean;
  durationMs?: number;
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!active) {
      setPct(0);
      return;
    }
    setPct(4);
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      // easing: approach 95% asymptotically
      const target = 95 * (1 - Math.exp(-elapsed / (durationMs * 0.5)));
      setPct(Math.max(4, Math.min(95, target)));
    }, 120);
    return () => clearInterval(t);
  }, [active, durationMs]);
  if (!active && pct === 0) return null;
  const shown = active ? pct : 100;
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className={cn("h-3 w-3", active && "animate-spin")} /> {label}
        </span>
        <span className="tabular-nums font-medium text-primary">{Math.round(shown)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${shown}%` }}
        />
      </div>
    </div>
  );
}

export function ErrorBlock({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="font-medium text-destructive">Gagal memuat data</div>
      {message && <div className="mt-1 text-muted-foreground text-xs">{message}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const map = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/15 text-destructive",
    info: "bg-accent/15 text-accent-foreground",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        map,
      )}
    >
      {children}
    </span>
  );
}
