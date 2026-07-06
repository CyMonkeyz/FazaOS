import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Wallet,
  CalendarCheck,
  Briefcase,
  HeartPulse,
  LineChart,
  Menu,
  Plus,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QuickAddModal } from "@/components/QuickAdd";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/activity", label: "Activity", icon: CalendarCheck },
  { to: "/business", label: "Business", icon: Briefcase },
  { to: "/health", label: "Health", icon: HeartPulse },
  { to: "/review", label: "Review", icon: LineChart },
  { to: "/more", label: "More", icon: Menu },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Faza OS</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Personal OS</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button className="w-full" onClick={() => setQuickOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Quick Add
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="md:pl-56 pb-24 md:pb-8">
        <div className="mx-auto max-w-3xl px-4 pt-4 md:pt-8">{children}</div>
      </main>

      {/* Mobile Quick Add FAB */}
      <button
        onClick={() => setQuickOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95"
        aria-label="Quick Add"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="grid grid-cols-7">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      <QuickAddModal open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
