import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Users, Edit3 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function OrgsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("active");
  const [startedOn, setStartedOn] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .is("deleted_at", null)
        .order("status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!name.trim()) throw new Error("Nama wajib diisi");
      const payload = {
        name,
        role: role || null,
        kind: kind || null,
        status,
        started_on: startedOn || null,
        ended_on: endedOn || null,
        notes: notes || null,
      };
      const { error } = editing
        ? await (supabase as any).from("organizations").update(payload).eq("id", editing.id)
        : await (supabase as any).from("organizations").insert({ user_id: u.user!.id, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Organisasi diperbarui" : "Organisasi ditambahkan");
      setName("");
      setRole("");
      setKind("");
      setStatus("active");
      setStartedOn("");
      setEndedOn("");
      setNotes("");
      setEditing(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organizations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Dihapus");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setName("");
                setRole("");
                setKind("");
                setStatus("active");
                setStartedOn("");
                setEndedOn("");
                setNotes("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Organisasi
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Organisasi" : "Tambah Organisasi"}</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Peran</Label>
                <Input
                  placeholder="mis. Ketua Divisi"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div>
                <Label>Jenis</Label>
                <Input
                  placeholder="mis. BEM, UKM, Komunitas"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Tidak aktif</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mulai jabatan</Label>
                  <Input
                    type="date"
                    value={startedOn}
                    onChange={(e) => setStartedOn(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Selesai jabatan</Label>
                  <Input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} />
                </div>
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
          title="Belum ada organisasi"
          description="Catat organisasi yang kamu ikuti."
          icon={Users}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {data!.map((o: any) => (
            <Card key={o.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{o.name}</div>
                    <StatusBadge tone={o.status === "active" ? "success" : "default"}>
                      {o.status}
                    </StatusBadge>
                  </div>
                  {o.role && <div className="text-xs text-muted-foreground mt-0.5">{o.role}</div>}
                  {o.kind && <div className="text-xs text-muted-foreground">{o.kind}</div>}
                  {(o.started_on || o.ended_on) && (
                    <div className="text-xs text-muted-foreground">
                      Masa jabatan: {o.started_on ?? "?"} - {o.ended_on ?? "sekarang"}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(o);
                      setName(o.name ?? "");
                      setRole(o.role ?? "");
                      setKind(o.kind ?? "");
                      setStatus(o.status ?? "active");
                      setStartedOn(o.started_on ?? "");
                      setEndedOn(o.ended_on ?? "");
                      setNotes(o.notes ?? "");
                      setOpen(true);
                    }}
                    className="text-muted-foreground hover:text-primary p-1"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Hapus organisasi?",
                          description: `"${o.name}" akan diarsipkan dari daftar organisasi.`,
                          confirmText: "Hapus",
                        })
                      )
                        remove.mutate(o.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
