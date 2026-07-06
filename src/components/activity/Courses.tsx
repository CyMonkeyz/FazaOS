import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock } from "@/components/ui-lite";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, ExternalLink, Edit3 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";

export function CoursesTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [sks, setSks] = useState("");
  const [semester, setSemester] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const db = supabase as any;

  const { data, isLoading } = useQuery({
    queryKey: ["courses-full"],
    queryFn: async () => {
      const { data, error } = await db
        .from("courses")
        .select("*")
        .is("deleted_at", null)
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
        code: code || null,
        lecturer: lecturer || null,
        sks: sks ? Number(sks) : 0,
        semester: semester || null,
        resource_url: resourceUrl || null,
      };
      const { error } = editing
        ? await db.from("courses").update(payload).eq("id", editing.id)
        : await db.from("courses").insert({ user_id: u.user!.id, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Mata kuliah diperbarui" : "Mata kuliah ditambahkan");
      setName("");
      setCode("");
      setLecturer("");
      setSks("");
      setSemester("");
      setResourceUrl("");
      setEditing(null);
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("courses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
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
                setCode("");
                setLecturer("");
                setSks("");
                setSemester("");
                setResourceUrl("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Mata Kuliah
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Mata Kuliah" : "Tambah Mata Kuliah"}</SheetTitle>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Kode</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div>
                  <Label>SKS</Label>
                  <Input inputMode="numeric" value={sks} onChange={(e) => setSks(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Dosen</Label>
                <Input value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
              </div>
              <div>
                <Label>Semester</Label>
                <Input
                  placeholder="mis. Ganjil 2025"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                />
              </div>
              <div>
                <Label>Link resource</Label>
                <Input
                  type="url"
                  placeholder="https://notion.so/..."
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
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
          title="Belum ada mata kuliah"
          description="Tambah mata kuliah untuk mengelompokkan tugas."
          icon={BookOpen}
        />
      ) : (
        <Card className="divide-y">
          {data!.map((c: any) => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {c.name}{" "}
                  {c.code && <span className="text-xs text-muted-foreground">({c.code})</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.lecturer && <span>{c.lecturer} · </span>}
                  {c.sks > 0 && <span>{c.sks} SKS</span>}
                  {c.semester && <span> · {c.semester}</span>}
                </div>
                {c.resource_url && (
                  <a
                    href={c.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Buka resource <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditing(c);
                    setName(c.name ?? "");
                    setCode(c.code ?? "");
                    setLecturer(c.lecturer ?? "");
                    setSks(c.sks ? String(c.sks) : "");
                    setSemester(c.semester ?? "");
                    setResourceUrl(c.resource_url ?? "");
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
                        title: "Hapus mata kuliah?",
                        description: `"${c.name}" akan diarsipkan dari tab kuliah.`,
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
          ))}
        </Card>
      )}
    </div>
  );
}
