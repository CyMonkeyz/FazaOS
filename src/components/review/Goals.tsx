import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { toast } from "sonner";
import { Plus, Trash2, Target } from "lucide-react";
import { deadlineLabel } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmProvider";

export function GoalsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("personal");
  const [targetDate, setTargetDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .is("deleted_at", null)
        .order("status")
        .order("target_date", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!title.trim()) throw new Error("Judul wajib diisi");
      const { error } = await supabase.from("goals").insert({
        user_id: u.user!.id,
        title,
        area,
        target_date: targetDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal ditambahkan");
      setTitle("");
      setTargetDate("");
      setArea("personal");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const { error } = await supabase
        .from("goals")
        .update({
          progress,
          status: progress >= 100 ? "achieved" : "active",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goals")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Dihapus");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Goal
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Tambah Goal</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Judul</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label>Area</Label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="academic">Akademik</SelectItem>
                    <SelectItem value="business">Bisnis</SelectItem>
                    <SelectItem value="money">Finansial</SelectItem>
                    <SelectItem value="health">Kesehatan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target tanggal</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada goal"
          description="Tetapkan target untuk fokus jangka panjang."
          icon={Target}
        />
      ) : (
        <div className="space-y-2">
          {data!.map((g: any) => (
            <Card key={g.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{g.title}</div>
                    <StatusBadge tone={g.status === "achieved" ? "success" : "default"}>
                      {g.area}
                    </StatusBadge>
                  </div>
                  {g.target_date && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Target: {deadlineLabel(g.target_date)}
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium tabular-nums">{g.progress}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={g.progress}
                      onChange={(e) =>
                        setProgress.mutate({ id: g.id, progress: Number(e.target.value) })
                      }
                      className="mt-1 w-full accent-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Hapus goal?",
                        description: `"${g.title}" akan diarsipkan dari daftar goal.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate(g.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
