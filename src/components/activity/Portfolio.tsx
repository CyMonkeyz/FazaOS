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
import { Plus, Trash2, Award, ExternalLink, Edit3 } from "lucide-react";
import { formatDateID } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmProvider";

const KINDS = [
  "project",
  "certificate",
  "publication",
  "volunteer",
  "seminar",
  "committee",
  "other",
];

export function PortfolioTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("project");
  const [role, setRole] = useState("");
  const [dateOn, setDateOn] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [filterKind, setFilterKind] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .is("deleted_at", null)
        .order("date_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!title.trim()) throw new Error("Judul wajib diisi");
      const payload = {
        title,
        kind,
        role: role || null,
        date_on: dateOn || null,
        link: link || null,
        description: description || null,
      };
      const { error } = editing
        ? await supabase.from("portfolio_items").update(payload).eq("id", editing.id)
        : await supabase.from("portfolio_items").insert({ user_id: u.user!.id, ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Portfolio diperbarui" : "Ditambahkan ke portfolio");
      setTitle("");
      setKind("project");
      setRole("");
      setDateOn("");
      setLink("");
      setDescription("");
      setEditing(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["portfolio_items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("portfolio_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_items"] });
      toast.success("Dihapus");
    },
  });

  const filtered = (data ?? []).filter((p: any) => filterKind === "all" || p.kind === filterKind);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={filterKind} onValueChange={setFilterKind}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setTitle("");
                setKind("project");
                setRole("");
                setDateOn("");
                setLink("");
                setDescription("");
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Item
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Portfolio" : "Tambah Portfolio"}</SheetTitle>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Jenis</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={dateOn} onChange={(e) => setDateOn(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Peran</Label>
                <Input
                  placeholder="mis. Panitia, Peserta, Founder"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div>
                <Label>Link</Label>
                <Input
                  placeholder="https://..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Belum ada item"
          description="Simpan sertifikat, project, seminar, volunteer, dan kepanitiaan."
          icon={Award}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((p: any) => (
            <Card key={p.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <StatusBadge tone="default">{p.kind}</StatusBadge>
                  </div>
                  {p.role && <div className="text-xs text-muted-foreground mt-0.5">{p.role}</div>}
                  {p.date_on && (
                    <div className="text-xs text-muted-foreground">{formatDateID(p.date_on)}</div>
                  )}
                  {p.description && (
                    <div className="text-xs mt-1 line-clamp-2">{p.description}</div>
                  )}
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary mt-1 inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Buka
                    </a>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setTitle(p.title ?? "");
                      setKind(p.kind ?? "project");
                      setRole(p.role ?? "");
                      setDateOn(p.date_on ?? "");
                      setLink(p.link ?? "");
                      setDescription(p.description ?? "");
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
                          title: "Hapus item portfolio?",
                          description: `"${p.title}" akan diarsipkan dari portfolio.`,
                          confirmText: "Hapus",
                        })
                      )
                        remove.mutate(p.id);
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
