import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui-lite";
import { toast } from "sonner";
import { formatDateID } from "@/lib/format";

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
            className={`h-8 rounded-md text-xs font-medium transition-colors ${value === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DailyLogTab() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [focus, setFocus] = useState(0);
  const [wins, setWins] = useState("");
  const [struggles, setStruggles] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [workoutNote, setWorkoutNote] = useState("");
  const [soreness, setSoreness] = useState(0);
  const [stress, setStress] = useState(0);
  const [sleepQuality, setSleepQuality] = useState(0);
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["daily_log", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("log_date", date)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: recovery } = useQuery({
    queryKey: ["recovery_log", date],
    queryFn: async () => {
      const { data, error } = await db
        .from("recovery_logs")
        .select("*")
        .eq("log_date", date)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: recent } = useQuery({
    queryKey: ["daily_logs_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("log_date,mood,wins")
        .is("deleted_at", null)
        .order("log_date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    setMood(data?.mood ?? 0);
    setEnergy(data?.energy ?? 0);
    setFocus(data?.focus ?? 0);
    setWins(data?.wins ?? "");
    setStruggles(data?.struggles ?? "");
    setGratitude(data?.gratitude ?? "");
    setTomorrow(data?.tomorrow_focus ?? "");
  }, [data, date]);

  useEffect(() => {
    setWorkoutNote(recovery?.notes ?? "");
    setSoreness(recovery?.soreness ?? 0);
    setStress(recovery?.stress ?? 0);
    setSleepQuality(recovery?.sleep_quality ?? 0);
  }, [recovery, date]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        user_id: u.user!.id,
        log_date: date,
        mood: mood || null,
        energy: energy || null,
        focus: focus || null,
        wins: wins || null,
        struggles: struggles || null,
        gratitude: gratitude || null,
        tomorrow_focus: tomorrow || null,
      };
      const { error } = await supabase
        .from("daily_logs")
        .upsert(payload, { onConflict: "user_id,log_date" });
      if (error) throw error;
      if (workoutNote || soreness || stress || sleepQuality) {
        const recoveryScore =
          100 -
          (Math.max(0, soreness - 1) + Math.max(0, stress - 1) + Math.max(0, 5 - sleepQuality)) *
            10;
        const { error: recErr } = await db.from("recovery_logs").upsert(
          {
            user_id: u.user!.id,
            log_date: date,
            soreness: soreness || null,
            stress: stress || null,
            sleep_quality: sleepQuality || null,
            energy: energy || null,
            recovery_score: Math.max(0, Math.min(100, recoveryScore)),
            notes: workoutNote || null,
          },
          { onConflict: "user_id,log_date" },
        );
        if (recErr) throw recErr;
      }
    },
    onSuccess: () => {
      toast.success("Log tersimpan");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-3">
      <div>
        <Label>Tanggal</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Card className="space-y-3 p-4">
        <ScoreRow label="Mood" value={mood} onChange={setMood} />
        <ScoreRow label="Energi" value={energy} onChange={setEnergy} />
        <ScoreRow label="Fokus" value={focus} onChange={setFocus} />
      </Card>
      <div>
        <Label>Menang hari ini</Label>
        <Textarea
          rows={2}
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          placeholder="Apa yang berhasil?"
        />
      </div>
      <div>
        <Label>Struggle</Label>
        <Textarea
          rows={2}
          value={struggles}
          onChange={(e) => setStruggles(e.target.value)}
          placeholder="Apa yang menghambat?"
        />
      </div>
      <div>
        <Label>Gratitude</Label>
        <Textarea
          rows={2}
          value={gratitude}
          onChange={(e) => setGratitude(e.target.value)}
          placeholder="3 hal yang kamu syukuri"
        />
      </div>
      <div>
        <Label>Fokus besok</Label>
        <Textarea rows={2} value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} />
      </div>
      <Card className="space-y-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workout & recovery
        </div>
        <ScoreRow label="Pegall/soreness" value={soreness} onChange={setSoreness} />
        <ScoreRow label="Stress badan" value={stress} onChange={setStress} />
        <ScoreRow label="Kualitas tidur" value={sleepQuality} onChange={setSleepQuality} />
        <div>
          <Label>Catatan workout/recovery</Label>
          <Textarea
            rows={2}
            value={workoutNote}
            onChange={(e) => setWorkoutNote(e.target.value)}
            placeholder="Latihan apa, badan terasa gimana, perlu rest?"
          />
        </div>
      </Card>
      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        Simpan Log
      </Button>

      {(recent ?? []).length > 0 && (
        <div>
          <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            7 Hari Terakhir
          </div>
          <Card className="divide-y">
            {recent!.map((r) => (
              <button
                key={r.log_date}
                onClick={() => setDate(r.log_date)}
                className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
              >
                <div>
                  <div className="text-sm font-medium">{formatDateID(r.log_date)}</div>
                  {r.wins && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{r.wins}</div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Mood {r.mood ?? "—"}/5</span>
              </button>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
