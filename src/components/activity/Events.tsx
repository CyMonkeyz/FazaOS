import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, MapPin, CalendarCheck, Edit3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/gcal.functions";
import { useConfirm } from "@/components/ConfirmProvider";

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventsTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const createGCal = useServerFn(createCalendarEvent);
  const deleteGCal = useServerFn(deleteCalendarEvent);
  const updateGCal = useServerFn(updateCalendarEvent);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("other");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [syncGCal, setSyncGCal] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["activity_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .is("deleted_at", null)
        .gte("starts_at", new Date(Date.now() - 86400000).toISOString())
        .order("starts_at")
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!title.trim()) throw new Error("Judul wajib diisi");
      let gcalId: string | null = null;
      if (syncGCal) {
        try {
          const r = await createGCal({
            data: {
              title,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: endsAt ? new Date(endsAt).toISOString() : null,
              location: location || null,
              description: notes || null,
            },
          });
          gcalId = r.id;
        } catch (e) {
          toast.error("GCal sync gagal: " + (e as Error).message);
        }
      }
      const { error } = await supabase.from("activity_events").insert({
        user_id: u.user!.id,
        title,
        kind: kind as never,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        location: location || null,
        notes: notes || null,
        gcal_event_id: gcalId,
        gcal_synced_at: gcalId ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agenda ditambahkan");
      setTitle("");
      setLocation("");
      setNotes("");
      setEndsAt("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["activity_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!title.trim()) throw new Error("Judul wajib diisi");
      let syncedAt = editing.gcal_synced_at ?? null;
      if (editing.gcal_event_id && syncGCal) {
        await updateGCal({
          data: {
            eventId: editing.gcal_event_id,
            title,
            startsAt: new Date(startsAt).toISOString(),
            endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            location: location || null,
            description: notes || null,
          },
        });
        syncedAt = new Date().toISOString();
      }
      const { error } = await supabase
        .from("activity_events")
        .update({
          title,
          kind: kind as never,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          location: location || null,
          notes: notes || null,
          gcal_synced_at: syncedAt,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agenda diperbarui");
      setEditing(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["activity_events"] });
      qc.invalidateQueries({ queryKey: ["gcal-upcoming"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: { id: string; gcal_event_id?: string | null }) => {
      if (row.gcal_event_id) {
        try {
          await deleteGCal({ data: { eventId: row.gcal_event_id } });
        } catch {
          /* ignore */
        }
      }
      const { error } = await supabase
        .from("activity_events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_events"] });
      toast.success("Agenda dihapus");
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
                setTitle("");
                setKind("other");
                setStartsAt(new Date().toISOString().slice(0, 16));
                setEndsAt("");
                setLocation("");
                setNotes("");
                setSyncGCal(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Agenda Baru
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Agenda" : "Tambah Agenda"}</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editing) saveEdit.mutate();
                else create.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Judul</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <Label>Jenis</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Kuliah</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="personal">Pribadi</SelectItem>
                    <SelectItem value="other">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mulai</Label>
                  <Input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Selesai</Label>
                  <Input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Lokasi</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs cursor-pointer">
                <Checkbox checked={syncGCal} onCheckedChange={(v) => setSyncGCal(!!v)} />
                <span>Sync ke Google Calendar</span>
              </label>
              <Button
                type="submit"
                className="w-full"
                disabled={create.isPending || saveEdit.isPending}
              >
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
          title="Belum ada agenda"
          description="Tambah agenda manual atau sinkronkan Google Calendar."
        />
      ) : (
        <Card className="divide-y">
          {data!.map((e: any) => {
            const dt = new Date(e.starts_at);
            return (
              <div key={e.id} className="flex items-start gap-3 p-3">
                <div className="text-center w-12 shrink-0">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {dt.toLocaleDateString("id-ID", { month: "short" })}
                  </div>
                  <div className="text-lg font-semibold leading-none">{dt.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusBadge>{e.kind}</StatusBadge>
                    {e.gcal_event_id && (
                      <StatusBadge tone="success">
                        <CalendarCheck className="h-3 w-3 mr-0.5" />
                        GCal
                      </StatusBadge>
                    )}
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditing(e);
                    setTitle(e.title ?? "");
                    setKind(e.kind ?? "other");
                    setStartsAt(toLocalInput(e.starts_at));
                    setEndsAt(toLocalInput(e.ends_at));
                    setLocation(e.location ?? "");
                    setNotes(e.notes ?? "");
                    setSyncGCal(!!e.gcal_event_id);
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
                        title: "Hapus agenda?",
                        description: e.gcal_event_id
                          ? `Agenda "${e.title}" juga akan dihapus dari Google Calendar.`
                          : `Agenda "${e.title}" akan dihapus dari daftar aktif.`,
                        confirmText: "Hapus",
                      })
                    )
                      remove.mutate({ id: e.id, gcal_event_id: e.gcal_event_id });
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
