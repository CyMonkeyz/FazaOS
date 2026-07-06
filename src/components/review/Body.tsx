import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingBlock, SectionTitle, StatCard } from "@/components/ui-lite";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Activity, Droplet, HeartPulse, Moon, Ruler, Target, Weight } from "lucide-react";

const db = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

export function BodyTab() {
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [height, setHeight] = useState("");
  const [bodyGoal, setBodyGoal] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [vo2Max, setVo2Max] = useState("");
  const [sleep, setSleep] = useState("");
  const [sleepQ, setSleepQ] = useState("");
  const [water, setWater] = useState("");
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["body_metrics", "30d"],
    queryFn: async () => {
      const { data, error } = await db
        .from("body_metrics")
        .select("*")
        .gte("metric_date", monthAgo())
        .is("deleted_at", null)
        .order("metric_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latest = (data ?? []).slice(-1)[0];
  const latestHeight = latest?.height_cm ? Number(latest.height_cm) : null;
  const currentBmi =
    latestHeight && latest?.weight_kg ? Number(latest.weight_kg) / (latestHeight / 100) ** 2 : null;
  const idealRange = latestHeight
    ? {
        min: 18.5 * (latestHeight / 100) ** 2,
        max: 24.9 * (latestHeight / 100) ** 2,
      }
    : null;
  const avgSleep = (() => {
    const rows = (data ?? []).filter((r: any) => r.sleep_hours != null);
    if (rows.length === 0) return null;
    return rows.reduce((s: number, r: any) => s + Number(r.sleep_hours), 0) / rows.length;
  })();

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        user_id: u.user!.id,
        metric_date: date,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        body_goal: bodyGoal || null,
        body_fat_percentage: bodyFat ? Number(bodyFat) : null,
        vo2_max: vo2Max ? Number(vo2Max) : null,
        sleep_hours: sleep ? Number(sleep) : null,
        sleep_quality: sleepQ ? Math.max(1, Math.min(5, parseInt(sleepQ))) : null,
        water_liters: water ? Number(water) : null,
        steps: steps ? parseInt(steps) : null,
        notes: notes || null,
      };
      const { error } = await db.from("body_metrics").upsert(payload, {
        onConflict: "user_id,metric_date",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data tubuh tersimpan");
      setHeight("");
      setBodyGoal("");
      setWeight("");
      setBodyFat("");
      setVo2Max("");
      setSleep("");
      setSleepQ("");
      setWater("");
      setSteps("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["body_metrics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = (data ?? [])
    .filter((r: any) => r.weight_kg != null)
    .map((r: any) => ({
      label: r.metric_date.slice(5),
      date: r.metric_date,
      weight: Number(r.weight_kg),
      bodyFat: r.body_fat_percentage == null ? null : Number(r.body_fat_percentage),
    }));
  const weights = chartData.map((d: any) => d.weight);
  const yDomain =
    weights.length >= 2
      ? ([
          Math.max(0, Math.floor(Math.min(...weights) - 1)),
          Math.ceil(Math.max(...weights) + 1),
        ] as [number, number])
      : undefined;

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Berat terkini"
          value={latest?.weight_kg ? `${latest.weight_kg} kg` : "-"}
          icon={Weight}
        />
        <StatCard
          label="Tidur rata-rata"
          value={avgSleep ? `${avgSleep.toFixed(1)} jam` : "-"}
          icon={Moon}
        />
        <StatCard
          label="Air terakhir"
          value={latest?.water_liters ? `${latest.water_liters} L` : "-"}
          icon={Droplet}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Tinggi" value={latestHeight ? `${latestHeight} cm` : "-"} icon={Ruler} />
        <StatCard
          label="BMI"
          value={currentBmi ? currentBmi.toFixed(1) : "-"}
          hint={
            idealRange
              ? `Ideal: ${idealRange.min.toFixed(1)}-${idealRange.max.toFixed(1)} kg`
              : undefined
          }
          icon={HeartPulse}
          tone={currentBmi && currentBmi >= 18.5 && currentBmi <= 24.9 ? "success" : "default"}
        />
        <StatCard
          label="Body fat"
          value={latest?.body_fat_percentage ? `${latest.body_fat_percentage}%` : "-"}
          icon={Activity}
        />
        <StatCard label="VO2 Max" value={latest?.vo2_max ?? "-"} icon={Activity} />
      </div>

      {latest?.body_goal && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">Body goal</div>
              <div className="mt-1 text-sm text-muted-foreground">{latest.body_goal}</div>
            </div>
          </div>
        </Card>
      )}

      {chartData.length >= 2 && (
        <div>
          <SectionTitle>Tren Body 30 Hari</SectionTitle>
          <Card className="p-3">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 14, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.28} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    domain={yDomain}
                    width={34}
                    tickFormatter={(v) => `${v}kg`}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10 }}
                    formatter={(value, name) => [
                      name === "weight" ? `${Number(value).toFixed(1)} kg` : `${value}%`,
                      name === "weight" ? "Berat" : "Body fat",
                    ]}
                    labelFormatter={(label, rows) => rows?.[0]?.payload?.date ?? label}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="bodyFat"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Catat Hari Ini
        </div>
        <div>
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Tinggi (cm)</Label>
            <Input
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="170"
            />
          </div>
          <div>
            <Label>Berat (kg)</Label>
            <Input
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="70.5"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Body fat (%)</Label>
            <Input
              inputMode="decimal"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="opsional"
            />
          </div>
          <div>
            <Label>VO2 Max</Label>
            <Input
              inputMode="decimal"
              value={vo2Max}
              onChange={(e) => setVo2Max(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="opsional"
            />
          </div>
        </div>
        <div>
          <Label>Body goals</Label>
          <Input
            value={bodyGoal}
            onChange={(e) => setBodyGoal(e.target.value)}
            placeholder="mis. 68 kg lean, body fat 15%, tidur 7 jam"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Tidur (jam)</Label>
            <Input
              inputMode="decimal"
              value={sleep}
              onChange={(e) => setSleep(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="7"
            />
          </div>
          <div>
            <Label>Kualitas tidur 1-5</Label>
            <Input
              inputMode="numeric"
              value={sleepQ}
              onChange={(e) => setSleepQ(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Air (L)</Label>
            <Input
              inputMode="decimal"
              value={water}
              onChange={(e) => setWater(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
          <div>
            <Label>Langkah</Label>
            <Input
              inputMode="numeric"
              value={steps}
              onChange={(e) => setSteps(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div>
          <Label>Catatan</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          Simpan
        </Button>
      </Card>

      {(data ?? []).length === 0 && (
        <EmptyState
          title="Belum ada data tubuh"
          description="Isi berat, tinggi, tidur, air minum, dan metrik opsional untuk mulai melacak progres."
        />
      )}
    </div>
  );
}
