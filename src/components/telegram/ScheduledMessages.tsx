import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";

const db = supabase as any;
const toWibIso = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
export function ScheduledMessages() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    recurrence: "once",
    date: new Date().toISOString().slice(0, 10),
    time: "08:00",
    weekday: "1",
    monthDay: "1",
  });
  const query = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: async () => {
      const { data, error } = await db
        .from("scheduled_messages")
        .select("*")
        .is("deleted_at", null)
        .order("next_run_at");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesi berakhir");
      let date = form.date;
      if (form.recurrence === "daily") date = new Date().toISOString().slice(0, 10);
      if (form.recurrence === "weekly") {
        const d = new Date();
        while (d.getDay() !== Number(form.weekday)) d.setDate(d.getDate() + 1);
        date = d.toISOString().slice(0, 10);
      }
      if (form.recurrence === "monthly") {
        const d = new Date();
        d.setDate(Math.min(Number(form.monthDay), 28));
        if (d < new Date()) d.setMonth(d.getMonth() + 1);
        date = d.toISOString().slice(0, 10);
      }
      const { error } = await db.from("scheduled_messages").insert({
        user_id: auth.user.id,
        title: form.title,
        message: form.message,
        recurrence: form.recurrence,
        scheduled_time: form.time,
        scheduled_date: form.recurrence === "once" ? form.date : null,
        weekday: form.recurrence === "weekly" ? Number(form.weekday) : null,
        month_day: form.recurrence === "monthly" ? Number(form.monthDay) : null,
        next_run_at: toWibIso(date, form.time),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesan terjadwal dibuat");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = async (id: string, value: any) => {
    const { error } = await db.from("scheduled_messages").update(value).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Pesan Terjadwal</div>
            <div className="text-[11px] text-muted-foreground">Sekali atau berulang dalam WIB.</div>
          </div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-3 w-3" /> Jadwal
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Buat pesan terjadwal</SheetTitle>
            </SheetHeader>
            <form
              className="mx-auto mt-4 max-w-xl space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div>
                <Label>Judul</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Pesan Telegram</Label>
                <Textarea
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Pengulangan</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.recurrence}
                    onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                  >
                    <option value="once">Sekali</option>
                    <option value="daily">Harian</option>
                    <option value="weekly">Mingguan</option>
                    <option value="monthly">Bulanan</option>
                  </select>
                </div>
                <div>
                  <Label>Jam WIB</Label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
              {form.recurrence === "once" && (
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              )}
              {form.recurrence === "weekly" && (
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={form.weekday}
                  onChange={(e) => setForm({ ...form, weekday: e.target.value })}
                >
                  {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
              {form.recurrence === "monthly" && (
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={form.monthDay}
                  onChange={(e) => setForm({ ...form, monthDay: e.target.value })}
                />
              )}
              <Button className="w-full" disabled={save.isPending}>
                Simpan jadwal
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      {query.isLoading ? (
        <LoadingBlock />
      ) : !query.data?.length ? (
        <EmptyState
          title="Belum ada pesan terjadwal"
          description="Sora siap jadi alarm yang tidak snooze sendiri."
          icon={CalendarClock}
        />
      ) : (
        <div className="space-y-2">
          {query.data.map((row: any) => (
            <div key={row.id} className="flex items-center gap-2 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{row.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {row.recurrence} ·{" "}
                  {new Date(row.next_run_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                </div>
              </div>
              <StatusBadge tone={row.status === "active" ? "success" : "default"}>
                {row.status}
              </StatusBadge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  patch(row.id, { status: row.status === "active" ? "paused" : "active" })
                }
              >
                {row.status === "active" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  patch(row.id, { deleted_at: new Date().toISOString(), status: "cancelled" })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
