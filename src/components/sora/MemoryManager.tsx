import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, LoadingBlock } from "@/components/ui-lite";
const db = supabase as any;
export function MemoryManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other");
  const query = useQuery({
    queryKey: ["sora-profile-memory"],
    queryFn: async () => {
      const { data, error } = await db
        .from("sora_profile_memories")
        .select("id,category,content,updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: a } = await supabase.auth.getUser();
      if (!a.user) throw new Error("Sesi berakhir");
      const key = `manual:${crypto.randomUUID()}`;
      const { error } = await db
        .from("sora_profile_memories")
        .insert({ user_id: a.user.id, category, memory_key: key, content, source_channel: "web" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sora akan mengingat ini");
      setContent("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sora-profile-memory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = async (id: string) => {
    const { error } = await db
      .from("sora_profile_memories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["sora-profile-memory"] });
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Permanent Memory</div>
            <div className="text-[11px] text-muted-foreground">
              Tidak terhapus oleh rolling memory 90 hari.
            </div>
          </div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-3 w-3" />
              Memory
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Apa yang harus selalu Sora ingat?</SheetTitle>
            </SheetHeader>
            <form
              className="mx-auto mt-4 max-w-xl space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <div>
                <Label>Kategori</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "identity",
                    "communication",
                    "interest",
                    "education",
                    "work",
                    "project",
                    "goal",
                    "habit",
                    "appearance",
                    "other",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Informasi</Label>
                <Input
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <Button className="w-full" disabled={add.isPending}>
                Simpan permanen
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      {query.isLoading ? (
        <LoadingBlock />
      ) : !query.data?.length ? (
        <EmptyState
          title="Belum ada permanent memory"
          description="Katakan 'ingat ini ...' kepada Sora atau tambahkan di sini."
          icon={Brain}
        />
      ) : (
        <div className="space-y-2">
          {query.data.map((m: any) => (
            <div key={m.id} className="flex items-start gap-2 rounded-xl border p-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase text-primary">{m.category}</div>
                <div className="text-sm">{m.content}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
