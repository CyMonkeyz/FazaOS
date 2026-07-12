import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Wallet,
  CalendarCheck,
  Briefcase,
  HeartPulse,
  LineChart,
  Sprout,
  Menu,
  Plus,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QuickAddModal } from "@/components/QuickAdd";
import { Button } from "@/components/ui/button";

const desktopNav = [
  { to: "/home", label: "Beranda", icon: Home },
  { to: "/assistant", label: "Sora", icon: Sparkles },
  { to: "/money", label: "Keuangan", icon: Wallet },
  { to: "/activity", label: "Aktivitas", icon: CalendarCheck },
  { to: "/business", label: "Bisnis", icon: Briefcase },
  { to: "/health", label: "Kesehatan", icon: HeartPulse },
  { to: "/review", label: "Evaluasi", icon: LineChart },
  { to: "/growth", label: "Growth", icon: Sprout },
  { to: "/more", label: "Lainnya", icon: Menu },
] as const;

const mobileNav = [
  { to: "/home", label: "Beranda", icon: Home },
  { to: "/activity", label: "Aktivitas", icon: CalendarCheck },
  { to: "/assistant", label: "Sora", icon: Sparkles },
  { to: "/money", label: "Keuangan", icon: Wallet },
  { to: "/more", label: "Lainnya", icon: Menu },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/75 text-primary-foreground text-sm font-bold shadow-sm">
            F
          </div>
          <div>
            <div className="text-base font-semibold leading-tight tracking-tight">Faza OS</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              Hidup, lebih tertata.
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {desktopNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-4 w-4 transition-transform group-hover:scale-105" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button className="w-full rounded-xl" onClick={() => setQuickOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Tambah cepat
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            F
          </div>
          <div className="text-sm font-semibold tracking-tight">Faza OS</div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => setQuickOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </header>

      {!online && (
        <div className="sticky top-14 z-20 flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/15 px-3 py-2 text-xs font-medium md:top-0 md:ml-64">
          <WifiOff className="h-3.5 w-3.5" /> Mode offline — perubahan baru akan tersedia setelah
          koneksi kembali.
        </div>
      )}

      {/* Main */}
      <main className="pb-24 md:pl-64 md:pb-10">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 md:pt-8 lg:px-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-2">
          {mobileNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <item.icon className={cn("h-5 w-5", item.to === "/assistant" && "text-accent")} />
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
