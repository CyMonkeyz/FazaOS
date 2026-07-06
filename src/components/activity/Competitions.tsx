import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingBlock, StatusBadge } from "@/components/ui-lite";
import { toast } from "sonner";
import { Plus, Trash2, Trophy, Edit3 } from "lucide-react";
import { formatDateID } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmProvider";

const STATUSES = ["planned", "registered", "ongoing", "done", "cancelled"];

export function CompetitionsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [category, setCategory] = useState("");
  const [regDeadline, setRegDeadline] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState("planned");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [doneFor, setDoneFor] = useState<{ id: string; name: string } | null>(null);
  const [doneResult, setDoneResult] = useState("");
  const [doneNotes, setDoneNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("*")
        .is("deleted_at", null)
        .order("event_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!name.trim()) throw new Error("Nama lomba wajib diisi");
      const payload = {
        name,
        organizer: organizer || null,
        category: category || null,
        registration_deadline: regDeadline || null,
        event_date: eventDate || null,
        status,
        result: result || null,
        notes: notes || null,
      };
      const { error } = editing
        ? await supabase.from("competitions").update(payload).eq("id", editing.id)
        : await supabase.from("competitions").insert({ user_id: u.user!.id, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Lomba diperbarui" : "Lomba ditambahkan");
      setName("");
      setOrganizer("");
      setCategory("");
      setRegDeadline("");
      setEventDate("");
      setStatus("planned");
      setResult("");
      setNotes("");
      setEditing(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["competitions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCompetition = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string | null> }) => {
      const { error } = await (supabase as any).from("competitions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["competitions"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("competitions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
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
                setOrganizer("");
                setCategory("");
                setRegDeadline("");
                setEventDate("");
                setStatus("planned");
                setResult("");
                setNotes("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Lomba
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Lomba" : "Tambah Lomba"}</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Nama Lomba</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Penyelenggara</Label>
                  <Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
                </div>
                <div>
                  <Label>Kategori</Label>
                  <Input
                    placeholder="Karya Tulis, Debat.."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Deadline Daftar</Label>
                  <Input
                    type="date"
                    value={regDeadline}
                    onChange={(e) => setRegDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tanggal Lomba</Label>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hasil</Label>
                <Input
                  placeholder="mis. Juara 2, Finalis"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          title="Belum ada lomba"
          description="Catat lomba yang kamu ikuti atau incar."
          icon={Trophy}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {data!.map((c: any) => {
            const tone =
              c.status === "done"
                ? "success"
                : c.status === "cancelled"
                  ? "default"
                  : c.status === "ongoing"
                    ? "warning"
                    : "default";
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <StatusBadge tone={tone as any}>{c.status}</StatusBadge>
                    </div>
                    {c.organizer && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.organizer}
                        {c.category ? ` · ${c.category}` : ""}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      {c.registration_deadline && (
                        <span>Daftar: {formatDateID(c.registration_deadline)}</span>
                      )}
                      {c.event_date && <span>Lomba: {formatDateID(c.event_date)}</span>}
                    </div>
                    {c.result && (
                      <div className="text-xs mt-1 font-medium text-primary">🏆 {c.result}</div>
                    )}
                    <div className="mt-2">
                      <Select
                        value={c.status}
                        onValueChange={(v) => {
                          if (v === "done") {
                            setDoneFor({ id: c.id, name: c.name });
                            setDoneResult(c.result ?? "");
                            setDoneNotes(c.notes ?? "");
                            return;
                          }
                          updateCompetition.mutate({ id: c.id, patch: { status: v } });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(c);
                        setName(c.name ?? "");
                        setOrganizer(c.organizer ?? "");
                        setCategory(c.category ?? "");
                        setRegDeadline(c.registration_deadline ?? "");
                        setEventDate(c.event_date ?? "");
                        setStatus(c.status ?? "planned");
                        setResult(c.result ?? "");
                        setNotes(c.notes ?? "");
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
                            title: "Hapus lomba?",
                            description: `"${c.name}" akan diarsipkan dari daftar lomba.`,
                            confirmText: "Hapus",
                          })
                        )
                          remove.mutate(c.id);
                      }}
                      className="text-muted-foreground hover:text-destructive p-1"
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

      <Dialog open={!!doneFor} onOpenChange={(open) => !open && setDoneFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hasil lomba {doneFor?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!doneFor) return;
              updateCompetition.mutate({
                id: doneFor.id,
                patch: {
                  status: "done",
                  result: doneResult || null,
                  notes: doneNotes || null,
                },
              });
              setDoneFor(null);
            }}
          >
            <div>
              <Label>Hasil</Label>
              <Input
                placeholder="Juara 1, Finalis, Belum menang, dsb."
                value={doneResult}
                onChange={(e) => setDoneResult(e.target.value)}
              />
            </div>
            <div>
              <Label>Catatan evaluasi</Label>
              <Textarea rows={3} value={doneNotes} onChange={(e) => setDoneNotes(e.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={updateCompetition.isPending}>
              Simpan ke riwayat lomba
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
