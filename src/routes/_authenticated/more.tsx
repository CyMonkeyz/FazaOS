import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatusBadge, ProgressLoader } from "@/components/ui-lite";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  saveTelegramChatId,
  sendDailyDigest,
  registerTelegramCommands,
  getIntegrationStatus,
  sendTelegramTest,
  getNotifPrefs,
  updateNotifPrefs,
  type NotifPrefs,
} from "@/lib/telegram.functions";
import { resetAllAccountData } from "@/lib/account-reset.functions";

import {
  Brain,
  LogOut,
  MessageCircle,
  CalendarDays,
  RefreshCw,
  Copy,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Send,
  BellRing,
  Moon,
  Eye,
  ShieldAlert,
  Trash2,
  Briefcase,
  HeartPulse,
  LineChart,
} from "lucide-react";

import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

// Centralized command registry — kept in sync manually with telegram-bot.server.ts
// (server file is server-only, so we duplicate the display list here for the UI).
type UiCommand = {
  command: string;
  description: string;
  category: string;
};
const UI_COMMANDS: UiCommand[] = [
  { command: "start", description: "Hubungkan Telegram", category: "Dasar" },
  { command: "menu", description: "Menu ringkas", category: "Dasar" },
  { command: "unlink", description: "Putuskan akun", category: "Dasar" },
  { command: "brief", description: "Brief harian", category: "Hari Ini" },
  { command: "today", description: "Ringkasan hari ini", category: "Hari Ini" },
  { command: "fokus", description: "Fokus utama", category: "Hari Ini" },
  { command: "jadwal", description: "Jadwal hari ini", category: "Agenda" },
  { command: "agenda", description: "Agenda 3 hari", category: "Agenda" },
  { command: "notif", description: "Pengaturan notifikasi", category: "Notifikasi" },
  { command: "notif_on", description: "Aktifkan notifikasi", category: "Notifikasi" },
  { command: "notif_off", description: "Matikan notifikasi", category: "Notifikasi" },
];

const MODULE_LINKS = [
  {
    to: "/business",
    label: "Bisnis",
    icon: Briefcase,
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    to: "/health",
    label: "Kesehatan",
    icon: HeartPulse,
    tone: "bg-rose-500/10 text-rose-700",
  },
  {
    to: "/review",
    label: "Evaluasi",
    icon: LineChart,
    tone: "bg-sky-500/10 text-sky-700",
  },
] as const;

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({ meta: [{ title: "More — Faza OS" }] }),
  component: MorePage,
});

function MorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const saveChatId = useServerFn(saveTelegramChatId);
  const sendDigest = useServerFn(sendDailyDigest);
  const registerCmds = useServerFn(registerTelegramCommands);
  const fetchStatus = useServerFn(getIntegrationStatus);
  const testMsg = useServerFn(sendTelegramTest);
  const fetchPrefs = useServerFn(getNotifPrefs);
  const savePrefs = useServerFn(updateNotifPrefs);
  const resetAccount = useServerFn(resetAllAccountData);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [showAllCmd, setShowAllCmd] = useState(false);

  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["integration_status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const linked = !!status?.telegram.linked;
  const gcal = status?.googleCalendar;

  useEffect(() => {
    if (status?.telegram.chatId) setTelegramChatId(String(status.telegram.chatId));
  }, [status?.telegram.chatId]);

  const { data: prefs } = useQuery({
    queryKey: ["notif_prefs"],
    queryFn: () => fetchPrefs(),
    staleTime: 30_000,
  });

  const patchPref = useMutation({
    mutationFn: async (patch: Partial<NotifPrefs>) => savePrefs({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif_prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const P = (prefs ?? {}) as Partial<NotifPrefs>;
  const pv = (k: keyof NotifPrefs, def = true) => (P[k] === undefined ? def : !!P[k]);

  const grouped = useMemo(() => {
    const map = new Map<string, UiCommand[]>();
    for (const c of UI_COMMANDS) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries());
  }, []);

  const saveTelegramId = useMutation({
    mutationFn: async () => saveChatId({ data: { chatId: telegramChatId.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integration_status"] });
      refetchStatus();
      toast.success("Chat ID Telegram disimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const digest = useMutation({
    mutationFn: async () => sendDigest(),
    onSuccess: () => toast.success("Ringkasan dikirim ke Telegram"),
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => testMsg(),
    onSuccess: () => toast.success("Test dikirim ke Telegram"),
    onError: (e: Error) => toast.error(e.message),
  });

  const register = useMutation({
    mutationFn: async () => registerCmds(),
    onSuccess: (r) => toast.success(`${r.count} command didaftarkan ke Telegram`),
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("telegram_users")
        .update({ chat_id: null, linked_at: null })
        .eq("user_id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Telegram diputus");
      qc.invalidateQueries({ queryKey: ["integration_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fullReset = useMutation({
    mutationFn: async () => resetAccount({ data: { confirmation: "RESET FAZA OS" } }),
    onSuccess: async () => {
      toast.success("Semua data Faza OS akun ini sudah direset");
      await qc.cancelQueries();
      qc.clear();
      window.setTimeout(() => window.location.reload(), 600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestFullReset = () => {
    const first = window.confirm(
      "Reset akan menghapus SEMUA data Faza OS akun ini: uang, bisnis, activity, health, review, Telegram link, log Sora, dan integrasi. Akun login tetap ada. Lanjut?",
    );
    if (!first) return;
    const second = window.prompt(
      'Ketik "RESET FAZA OS" untuk konfirmasi terakhir. Data yang terhapus tidak bisa dikembalikan.',
    );
    if (second !== "RESET FAZA OS") {
      toast.error("Reset dibatalkan karena teks konfirmasi tidak cocok");
      return;
    }
    fullReset.mutate();
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-6 pb-4">
      <PageHeader title="Lainnya" subtitle="Modul, integrasi, dan pengaturan akun." />

      <section aria-labelledby="module-title">
        <div className="mb-2 flex items-center justify-between">
          <h2
            id="module-title"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Modul lainnya
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODULE_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-xl border bg-card p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <div
                className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sora Brain */}
      <Link to="/assistant" className="block">
        <Card className="p-4 hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 p-2.5">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Sora Brain</div>
              <div className="text-xs text-muted-foreground">
                Asisten pribadi Tuan — tahu semua data & modul.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      </Link>

      <div className="h-2" aria-hidden />

      {/* Telegram Bot */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Telegram Bot</h3>
          <StatusBadge tone={linked ? "success" : "default"}>
            {statusLoading ? "Memeriksa…" : linked ? "Terhubung" : "Belum ditautkan"}
          </StatusBadge>
        </div>

        {!linked ? (
          <>
            <p className="text-xs text-muted-foreground">
              Buka bot di Telegram dan kirim <b>/start</b>. Bot akan menampilkan Chat ID kamu.
              Masukkan Chat ID itu di sini agar bot hanya merespon akun Telegram terdaftar.
            </p>
            <Input
              inputMode="numeric"
              placeholder="Contoh: 123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
            <ProgressLoader label="Menyimpan Chat ID..." active={saveTelegramId.isPending} />
            <Button
              onClick={() => saveTelegramId.mutate()}
              disabled={saveTelegramId.isPending || !telegramChatId.trim()}
              className="w-full"
            >
              Simpan Chat ID Telegram
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Bot aktif untuk Chat ID <code>{String(status?.telegram.chatId ?? "")}</code>. Coba
              kirim <code>/menu</code>, <code>/today</code>, <code>/uang</code>.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() => saveTelegramId.mutate()}
                disabled={saveTelegramId.isPending || !telegramChatId.trim()}
              >
                Simpan
              </Button>
            </div>
            <ProgressLoader
              label="Mengirim ringkasan..."
              active={
                digest.isPending || test.isPending || register.isPending || saveTelegramId.isPending
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => test.mutate()}
                disabled={test.isPending}
              >
                <Send className="mr-1 h-3 w-3" /> Test kirim
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => digest.mutate()}
                disabled={digest.isPending}
              >
                Kirim brief
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => register.mutate()}
                disabled={register.isPending}
              >
                <ListChecks className="mr-1 h-3 w-3" /> Daftarkan menu bot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => unlink.mutate()}
                disabled={unlink.isPending}
              >
                Putus
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Notifikasi otomatis: 🌅 06:30 brief, 🧾 09:00 tagihan, ⏰ 20:30 review. Atur di bot
              dengan <code>/notif</code> atau <code>/quiet</code>.
            </p>
          </>
        )}
      </Card>

      {/* Notification preferences */}
      {linked && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Preferensi Notifikasi</h3>
          </div>
          <p className="text-[11px] text-muted-foreground">Atur notifikasi Telegram harian Tuan.</p>
          <div className="space-y-1.5">
            {(
              [
                ["notify_morning_brief", "🌅 Brief Pagi (06:30 WIB)"],
                ["notify_midday_check", "☀️ Cek Siang (12:30 WIB)"],
                ["notify_night_review", "🌙 Review Malam (20:30 WIB)"],
                ["notify_workout", "💪 Pengingat Workout"],
                ["notify_debt_due", "💳 Hutang jatuh tempo"],
                ["notify_receivable_due", "💰 Piutang jatuh tempo"],
                ["notify_deadline", "⏰ Deadline tugas urgent"],
                ["notify_habits", "🌱 Pengingat habit"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-2 rounded-md border bg-card/50 px-3 py-2 cursor-pointer"
              >
                <span className="text-xs">{label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={pv(key, true)}
                  onChange={(e) =>
                    patchPref.mutate({ [key]: e.target.checked } as Partial<NotifPrefs>)
                  }
                />
              </label>
            ))}
            <label className="flex items-center justify-between gap-2 rounded-md border bg-card/50 px-3 py-2 cursor-pointer">
              <span className="text-xs flex items-center gap-1">
                <Eye className="h-3 w-3" /> Tampilkan nominal uang di Telegram
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={pv("show_amounts_in_telegram", false)}
                onChange={(e) => patchPref.mutate({ show_amounts_in_telegram: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md border bg-card/50 px-3 py-2 cursor-pointer">
              <span className="text-xs flex items-center gap-1">
                <Moon className="h-3 w-3" /> Jam tenang aktif
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={pv("quiet_hours_enabled", false)}
                onChange={(e) => patchPref.mutate({ quiet_hours_enabled: e.target.checked })}
              />
            </label>
            {pv("quiet_hours_enabled", false) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="text-[10px] text-muted-foreground">
                  Mulai
                  <input
                    type="time"
                    defaultValue={
                      (P.quiet_hours_start as string | undefined)?.slice(0, 5) ?? "22:00"
                    }
                    onBlur={(e) => patchPref.mutate({ quiet_hours_start: e.target.value + ":00" })}
                    className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  Selesai
                  <input
                    type="time"
                    defaultValue={(P.quiet_hours_end as string | undefined)?.slice(0, 5) ?? "05:30"}
                    onBlur={(e) => patchPref.mutate({ quiet_hours_end: e.target.value + ":00" })}
                    className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-xs"
                  />
                </label>
              </div>
            )}
          </div>
          <ProgressLoader label="Menyimpan…" active={patchPref.isPending} />
        </Card>
      )}

      {/* Command list */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Daftar Command Telegram</h3>
          <StatusBadge tone="default">{UI_COMMANDS.length}</StatusBadge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Semua perintah bot Faza OS. Tap “Salin” untuk menyalin ke clipboard.
        </p>
        <div className="space-y-3">
          {grouped.slice(0, showAllCmd ? grouped.length : 3).map(([cat, items]) => (
            <div key={cat}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {cat}
              </div>
              <div className="space-y-1">
                {items.map((c) => (
                  <div
                    key={c.command}
                    className="flex items-center gap-2 rounded-md border bg-card/50 px-2 py-1.5"
                  >
                    <code className="text-[11px] font-mono text-primary shrink-0">
                      /{c.command}
                    </code>
                    <span className="text-[11px] text-muted-foreground truncate flex-1">
                      {c.description}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`/${c.command}`);
                        toast.success(`/${c.command} disalin`);
                      }}
                      className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                      aria-label={`Salin /${c.command}`}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAllCmd((s) => !s)}
        >
          {showAllCmd ? "Sembunyikan" : `Lihat semua (${grouped.length - 3} kategori lagi)`}
        </Button>
        <p className="text-[10px] text-muted-foreground italic">
          Privasi: nominal uang hanya ditampilkan di Telegram jika pengaturan “Tampilkan nominal di
          Telegram” aktif.
        </p>
      </Card>

      {/* Google Calendar — real status */}
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Google Calendar</h3>
          {statusLoading ? (
            <StatusBadge tone="default">Memeriksa…</StatusBadge>
          ) : gcal?.connected ? (
            <StatusBadge tone="success">Terhubung</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Belum terhubung</StatusBadge>
          )}
        </div>
        {gcal?.connected ? (
          <>
            <p className="text-xs text-muted-foreground">
              {typeof gcal.eventCountUpcoming === "number"
                ? `${gcal.eventCountUpcoming} event dalam 30 hari ke depan.`
                : "Terhubung ke calendar utama."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Saat tambah agenda di <b>Activity</b>, centang “Sync ke Google Calendar”.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-[11px] text-warning-foreground">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-warning" />
              <span>
                {gcal?.error ?? "Google Calendar belum tersambung."} Hubungkan dari Lovable →
                Workspace Connectors.
              </span>
            </div>
          </>
        )}
        <Button variant="ghost" size="sm" className="w-full" onClick={() => refetchStatus()}>
          <RefreshCw className="mr-1 h-3 w-3" /> Cek ulang
        </Button>
      </Card>

      <Card className="border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Reset Semua Data</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Menghapus seluruh data Faza OS milik akun ini dan membuat ulang profil kosong. Login
          Supabase tetap ada, tapi data aplikasi mulai dari nol.
        </p>
        <Button
          variant="destructive"
          className="w-full"
          onClick={requestFullReset}
          disabled={fullReset.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {fullReset.isPending ? "Mereset data..." : "Reset seluruh data"}
        </Button>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Keluar
      </Button>
    </div>
  );
}

// Prevent unused import warning (icon set intentionally imported for future use).
void CheckCircle2;
