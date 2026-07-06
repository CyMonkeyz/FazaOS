import { useEffect, useMemo, useState } from "react";
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
import { deadlineLabel, daysUntil } from "@/lib/format";
import { toast } from "sonner";
import { Edit3, GripVertical, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

const priorityTone = { low: "default", medium: "info", high: "warning", urgent: "danger" } as const;
const columns = [
  { id: "todo", label: "Belum dikerjakan" },
  { id: "in_progress", label: "Sedang dikerjakan" },
  { id: "done", label: "Selesai" },
] as const;

type TaskStatus = (typeof columns)[number]["id"];
type Priority = "low" | "medium" | "high" | "urgent";
type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  priority: Priority;
  due_date: string | null;
  status: TaskStatus;
  courses?: { name?: string | null } | null;
};

const emptyForm = {
  title: "",
  description: "",
  courseId: "none",
  priority: "medium" as Priority,
  dueDate: "",
  status: "todo" as TaskStatus,
};

export function TasksTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id,name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["academic_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_tasks")
        .select("*, courses(name)")
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setForm(emptyForm);
    }
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, TaskRow[]>(columns.map((col) => [col.id, []]));
    for (const task of data ?? []) map.get(task.status ?? "todo")?.push(task);
    return map;
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!form.title.trim()) throw new Error("Judul wajib diisi");
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        course_id: form.courseId === "none" ? null : form.courseId,
        priority: form.priority,
        due_date: form.dueDate || null,
        status: form.status,
        completed_at: form.status === "done" ? new Date().toISOString() : null,
      };
      const query = editing
        ? supabase.from("academic_tasks").update(payload).eq("id", editing.id)
        : supabase.from("academic_tasks").insert({ user_id: u.user!.id, ...payload });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Tugas diperbarui" : "Tugas ditambahkan");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["academic_tasks"] });
      qc.invalidateQueries({ queryKey: ["home-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from("academic_tasks")
        .update({
          status,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_tasks"] });
      qc.invalidateQueries({ queryKey: ["home-summary"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("academic_tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_tasks"] });
      qc.invalidateQueries({ queryKey: ["home-summary"] });
      toast.success("Tugas dihapus");
    },
  });

  const startEdit = (task: TaskRow) => {
    setEditing(task);
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      courseId: task.course_id ?? "none",
      priority: task.priority ?? "medium",
      dueDate: task.due_date ?? "",
      status: task.status ?? "todo",
    });
    setOpen(true);
  };

  const field = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Tugas Baru
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Tugas" : "Tambah Tugas Akademik"}</SheetTitle>
            </SheetHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <Label>Judul</Label>
                <Input
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mata Kuliah</Label>
                  <Select value={form.courseId} onValueChange={(v) => field("courseId", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      {(courses ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioritas</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => field("priority", v as Priority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Deadline</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => field("dueDate", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => field("status", v as TaskStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                Simpan
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Belum ada tugas" description="Tambahkan tugas akademik pertama kamu." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((col) => (
            <Card
              key={col.id}
              className="min-h-40 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingId) setStatus.mutate({ id: draggingId, status: col.id });
                setDraggingId(null);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">{col.label}</div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {grouped.get(col.id)?.length ?? 0}
                </span>
              </div>
              <div className="space-y-2">
                {(grouped.get(col.id) ?? []).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => startEdit(task)}
                    onDelete={async () => {
                      if (
                        await confirm({
                          title: "Hapus tugas?",
                          description: `Tugas "${task.title}" akan dihapus dari daftar aktif.`,
                          confirmText: "Hapus",
                        })
                      )
                        remove.mutate(task.id);
                    }}
                    onDragStart={() => setDraggingId(task.id)}
                  />
                ))}
                {(grouped.get(col.id) ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Drop tugas ke sini
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: TaskRow;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
}) {
  const d = daysUntil(task.due_date);
  const isDone = task.status === "done";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-lg border bg-background p-3 text-sm shadow-sm"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className={`font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {task.courses?.name && <span>{task.courses.name}</span>}
            <StatusBadge tone={priorityTone[task.priority]}>{task.priority}</StatusBadge>
            {task.due_date && (
              <span
                className={d !== null && d <= 2 && !isDone ? "font-medium text-destructive" : ""}
              >
                {deadlineLabel(task.due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-primary">
            <Edit3 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
