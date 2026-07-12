import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingBlock } from "@/components/ui-lite";
import { toast } from "sonner";

function mondayOf(d: Date) {
  const day = d.getDay() || 7;
  const m = new Date(d);
  m.setDate(d.getDate() - day + 1);
  return m.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value || "—"}/5</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 rounded-md text-xs font-medium ${value === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WeeklyTab() {
  const qc = useQueryClient();
  const weekStart = mondayOf(new Date());
  const weekEnd = addDaysIso(weekStart, 6);
  const [state, setState] = useState({
    highlights: "",
    lessons: "",
    next_week_focus: "",
    score_money: 0,
    score_academic: 0,
    score_organization: 0,
    score_business: 0,
    score_health: 0,
  });
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["weekly_review", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("week_start", weekStart)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: dailyCount, isLoading: isDailyLoading } = useQuery({
    queryKey: ["weekly_daily_count", weekStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("daily_logs")
        .select("id", { count: "exact", head: true })
        .gte("log_date", weekStart)
        .lte("log_date", weekEnd)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    setState({
      highlights: data?.highlights ?? "",
      lessons: data?.lessons ?? "",
      next_week_focus: data?.next_week_focus ?? "",
      score_money: data?.score_money ?? 0,
      score_academic: data?.score_academic ?? 0,
      score_organization: data?.score_organization ?? 0,
      score_business: data?.score_business ?? 0,
      score_health: data?.score_health ?? 0,
    });
  }, [data, weekStart]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        user_id: u.user!.id,
        week_start: weekStart,
        ...state,
        score_money: state.score_money || null,
        score_academic: state.score_academic || null,
        score_organization: state.score_organization || null,
        score_business: state.score_business || null,
        score_health: state.score_health || null,
        highlights: state.highlights || null,
        lessons: state.lessons || null,
        next_week_focus: state.next_week_focus || null,
      };
      const { error } = await supabase
        .from("weekly_reviews")
        .upsert(payload, { onConflict: "user_id,week_start" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Weekly review tersimpan");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || isDailyLoading) return <LoadingBlock />;

  if ((dailyCount ?? 0) < 7)
    return (
      <Card className="p-5">
        <div className="font-semibold">Weekly Review masih terkunci</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Daily Journal minggu ini baru {dailyCount ?? 0}/7. Isi satu jurnal unik setiap hari sampai
          lengkap.
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(((dailyCount ?? 0) / 7) * 100)}%` }}
          />
        </div>
      </Card>
    );

  const set = (k: keyof typeof state) => (v: any) => setState((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-3">
      <Card className="p-3 text-sm">
        <div className="font-medium">Weekly review minggu ini</div>
        <div className="text-xs text-muted-foreground">
          Periode fixed: {weekStart} sampai {weekEnd}. Daily journal terisi {dailyCount ?? 0}/7.
        </div>
      </Card>
      {!formOpen && (
        <Button onClick={() => setFormOpen(true)}>
          {data ? "Edit Weekly Review" : "Mulai Weekly Review"}
        </Button>
      )}
      {formOpen && (
        <>
          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Score Kartu</div>
            <ScoreRow label="Finansial" value={state.score_money} onChange={set("score_money")} />
            <ScoreRow
              label="Akademik"
              value={state.score_academic}
              onChange={set("score_academic")}
            />
            <ScoreRow
              label="Organisasi"
              value={state.score_organization}
              onChange={set("score_organization")}
            />
            <ScoreRow
              label="Bisnis"
              value={state.score_business}
              onChange={set("score_business")}
            />
            <ScoreRow label="Kesehatan" value={state.score_health} onChange={set("score_health")} />
          </Card>
          <div>
            <Label>Highlights</Label>
            <Textarea
              rows={3}
              value={state.highlights}
              onChange={(e) => set("highlights")(e.target.value)}
              placeholder="Apa hal terbaik minggu ini?"
            />
          </div>
          <div>
            <Label>Pelajaran</Label>
            <Textarea
              rows={3}
              value={state.lessons}
              onChange={(e) => set("lessons")(e.target.value)}
              placeholder="Apa yang kamu pelajari?"
            />
          </div>
          <div>
            <Label>Fokus minggu depan</Label>
            <Textarea
              rows={3}
              value={state.next_week_focus}
              onChange={(e) => set("next_week_focus")(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={save.isPending || (dailyCount ?? 0) < 7}
          >
            Simpan Review
          </Button>
        </>
      )}
    </div>
  );
}
