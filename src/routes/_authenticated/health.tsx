import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, EmptyState, LoadingBlock, StatCard, StatusBadge } from "@/components/ui-lite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { WorkoutTab } from "@/components/review/Workout";
import { BodyTab } from "@/components/review/Body";
import {
  Activity,
  Bed,
  Dumbbell,
  HeartPulse,
  Pill,
  Droplet,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "Health - Faza OS" }] }),
  component: HealthPage,
});

const db = supabase as any;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function computeWorkoutStreak(logs: Array<{ workout_date: string }>) {
  const dates = new Set(logs.map((log) => log.workout_date));
  let streak = 0;
  const cursor = new Date(todayIso() + "T00:00:00");
  for (let i = 0; i < 60; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dates.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function HealthPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Health"
        subtitle="Workout, body, suplemen, dan journal health yang ringan."
      />
      <Tabs defaultValue="dashboard" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="w-max">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="workout">Workout</TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="supplement">Supplement</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="dashboard" className="mt-4">
          <HealthDashboard />
        </TabsContent>
        <TabsContent value="workout" className="mt-4">
          <WorkoutTab />
        </TabsContent>
        <TabsContent value="body" className="mt-4">
          <BodyTab />
        </TabsContent>
        <TabsContent value="supplement" className="mt-4">
          <SupplementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HealthDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["health-dashboard"],
    queryFn: async () => {
      const today = todayIso();
      const [plans, logs, body, supplements] = await Promise.all([
        supabase
          .from("workout_plans")
          .select("id,title,status,workout_time,target_duration_minutes")
          .eq("workout_date", today)
          .is("deleted_at", null)
          .order("workout_time", { ascending: true, nullsFirst: true }),
        supabase
          .from("workout_logs")
          .select("workout_date,workout_type,duration_minutes")
          .is("deleted_at", null)
          .order("workout_date", { ascending: false })
          .limit(60),
        supabase
          .from("body_metrics")
          .select("metric_date,weight_kg,sleep_hours,sleep_quality,water_liters")
          .order("metric_date", { ascending: false })
          .limit(7),
        db
          .from("supplement_items")
          .select("name,stock_quantity,unit,low_stock_threshold")
          .is("deleted_at", null)
          .order("name"),
      ]);
      if (plans.error) throw plans.error;
      if (logs.error) throw logs.error;
      if (body.error) throw body.error;
      const bodyRows = body.data ?? [];
      const avg = (values: number[]) =>
        values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      const lowSupplements = supplements.error
        ? []
        : (supplements.data ?? []).filter(
            (s: any) => Number(s.stock_quantity ?? 0) <= Number(s.low_stock_threshold ?? 0),
          );
      return {
        plans: plans.data ?? [],
        streak: computeWorkoutStreak(logs.data ?? []),
        latestBody: bodyRows[0] ?? null,
        sleepAvg: avg(bodyRows.map((b) => Number(b.sleep_hours)).filter(Number.isFinite)),
        waterAvg: avg(bodyRows.map((b) => Number(b.water_liters)).filter(Number.isFinite)),
        lowSupplements,
        supplementsMissing: !!supplements.error,
      };
    },
  });

  if (isLoading) return <LoadingBlock />;
  const d = data!;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="Workout streak"
          value={`${d.streak} hari`}
          icon={Dumbbell}
          tone={d.streak > 0 ? "success" : "default"}
        />
        <StatCard
          label="Berat terbaru"
          value={d.latestBody?.weight_kg ? `${d.latestBody.weight_kg} kg` : "-"}
          icon={HeartPulse}
        />
        <StatCard
          label="Tidur avg"
          value={d.sleepAvg ? `${d.sleepAvg.toFixed(1)} jam` : "-"}
          icon={Bed}
        />
        <StatCard
          label="Air avg"
          value={d.waterAvg ? `${d.waterAvg.toFixed(1)} L` : "-"}
          icon={Droplet}
        />
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" /> Workout hari ini
        </div>
        {d.plans.length ? (
          <div className="space-y-2">
            {d.plans.map((plan: any) => (
              <div key={plan.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{plan.title}</span>
                <StatusBadge tone={plan.status === "completed" ? "success" : "default"}>
                  {plan.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Belum ada workout hari ini"
            description="Buat rencana di tab Workout."
            icon={Dumbbell}
          />
        )}
      </Card>
      <div className="grid gap-2 md:grid-cols-1">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Suplemen due/low stock</div>
          <div className="mt-2 text-sm">
            {d.supplementsMissing
              ? "Struktur modulnya belum ada di database saat ini."
              : d.lowSupplements.length
                ? d.lowSupplements.map((s: any) => s.name).join(", ")
                : "Aman"}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SupplementTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [frequency, setFrequency] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [low, setLow] = useState("0");
  const { data, isLoading, error } = useQuery({
    queryKey: ["supplements"],
    queryFn: async () => {
      const { data, error } = await db
        .from("supplement_items")
        .select(
          "id,name,category,dosage,dose_quantity,frequency,stock_quantity,unit,low_stock_threshold,price_per_unit,last_taken_at",
        )
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nama suplemen wajib diisi");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await db.from("supplement_items").insert({
        user_id: user.user!.id,
        name: name.trim(),
        dosage: dosage || null,
        dose_quantity: Number(doseQuantity || "1"),
        frequency: frequency || null,
        stock_quantity: Number(stock || "0"),
        unit: unit || null,
        low_stock_threshold: Number(low || "0"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suplemen ditambahkan");
      setName("");
      setDosage("");
      setDoseQuantity("1");
      setFrequency("");
      setStock("");
      setUnit("pcs");
      setLow("0");
      qc.invalidateQueries({ queryKey: ["supplements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateStock = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      const { error } = await db
        .from("supplement_items")
        .update({ stock_quantity: stock })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
  });
  const takeSupplement = useMutation({
    mutationFn: async (item: any) => {
      const { data: user } = await supabase.auth.getUser();
      const qty = Number(item.dose_quantity ?? 1);
      const nextStock = Math.max(0, Number(item.stock_quantity ?? 0) - qty);
      const now = new Date().toISOString();
      const { error: logError } = await db.from("supplement_logs").insert({
        user_id: user.user!.id,
        supplement_id: item.id,
        quantity: qty,
        taken_at: now,
      });
      if (logError) throw logError;
      const { error } = await db
        .from("supplement_items")
        .update({ stock_quantity: nextStock, last_taken_at: now })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dicatat diminum, stok ikut turun");
      qc.invalidateQueries({ queryKey: ["supplements"] });
      qc.invalidateQueries({ queryKey: ["health-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("supplement_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suplemen dihapus");
      qc.invalidateQueries({ queryKey: ["supplements"] });
    },
  });
  if (isLoading) return <LoadingBlock />;
  if (error) {
    return (
      <EmptyState
        title="Data suplemen belum bisa dimuat"
        description="Periksa koneksi lalu coba lagi. Jika tetap gagal, pastikan migrasi database terbaru sudah diterapkan."
        icon={Pill}
        action={
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Coba lagi
          </Button>
        }
      />
    );
  }
  const supplements = data ?? [];
  const lowStockCount = supplements.filter(
    (item: any) => Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 0),
  ).length;
  const totalRemainingDoses = supplements.reduce((sum: number, item: any) => {
    const dose = Number(item.dose_quantity ?? 1);
    if (dose <= 0) return sum;
    return sum + Math.floor(Number(item.stock_quantity ?? 0) / dose);
  }, 0);

  return (
    <Tabs defaultValue="active" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="active">Suplemen Aktif</TabsTrigger>
        <TabsTrigger value="add">Tambah Suplemen</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Aktif" value={supplements.length} icon={Pill} />
          <StatCard
            label="Low stock"
            value={lowStockCount}
            tone={lowStockCount > 0 ? "warning" : "success"}
          />
          <StatCard label="Sisa dosis" value={totalRemainingDoses} />
        </div>

        {!supplements.length ? (
          <EmptyState
            title="Belum ada suplemen"
            description="Tambah dari tab sebelah supaya daftar utama tetap bersih."
            icon={Pill}
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {supplements.map((item: any) => {
              const isLow =
                Number(item.stock_quantity ?? 0) <= Number(item.low_stock_threshold ?? 0);
              const dose = Number(item.dose_quantity ?? 1);
              const remainingDoses =
                dose > 0 ? Math.floor(Number(item.stock_quantity ?? 0) / dose) : 0;
              return (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.dosage || item.frequency || item.category || "Suplemen"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Dosis stok: {dose} {item.unit ?? ""} sekali minum · sisa kira-kira{" "}
                        {remainingDoses}x
                      </div>
                      {item.last_taken_at && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Terakhir diminum: {new Date(item.last_taken_at).toLocaleString("id-ID")}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => takeSupplement.mutate(item)}
                          disabled={
                            takeSupplement.isPending || Number(item.stock_quantity ?? 0) <= 0
                          }
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Diminum
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => {
                            const next = prompt("Update stok:", String(item.stock_quantity ?? 0));
                            if (next != null)
                              updateStock.mutate({ id: item.id, stock: Number(next) });
                          }}
                        >
                          Update stok
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge tone={isLow ? "warning" : "success"}>
                        {item.stock_quantity ?? 0} {item.unit ?? ""}
                      </StatusBadge>
                      <button
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "Hapus suplemen?",
                              description: `Suplemen "${item.name}" akan diarsipkan dari daftar aktif.`,
                              confirmText: "Hapus",
                            })
                          )
                            remove.mutate(item.id);
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="add" className="mt-4">
        <Card className="space-y-3 p-4">
          <div>
            <div className="text-sm font-medium">Tambah suplemen</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Isi stok dan qty per dosis supaya tombol "Diminum" bisa menghitung stok otomatis.
            </p>
          </div>
          <div>
            <Label>Nama</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whey, vitamin D..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Dosis</Label>
              <Input
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="1 scoop"
              />
            </div>
            <div>
              <Label>Frekuensi</Label>
              <Input
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="setelah workout"
              />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <Label>Qty/dosis</Label>
              <Input
                inputMode="decimal"
                value={doseQuantity}
                onChange={(e) => setDoseQuantity(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
            <div>
              <Label>Stok</Label>
              <Input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label>Low stock</Label>
              <Input inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Simpan suplemen
          </Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
