import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FilePlus2, FolderPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addDriveFolder,
  createBusinessSpreadsheet,
  getDriveFolders,
} from "@/lib/business-sheets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type TabConfig = {
  role: "summary" | "sales" | "expenses" | "products" | "stock" | "extra";
  name: string;
  columnsText: string;
};
const DEFAULT_TABS: TabConfig[] = [
  { role: "summary", name: "Summary", columnsText: "key, value" },
  { role: "sales", name: "Sales", columnsText: "date, order_id, product, quantity, total, profit" },
  { role: "expenses", name: "Expenses", columnsText: "date, category, amount, note" },
  { role: "products", name: "Products", columnsText: "sku, name, category, selling_price" },
  { role: "stock", name: "Stock", columnsText: "sku, name, quantity, minimum_stock" },
];
export function SpreadsheetCreator({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const qc = useQueryClient();
  const listFolders = useServerFn(getDriveFolders);
  const createFolder = useServerFn(addDriveFolder);
  const createSheet = useServerFn(createBusinessSpreadsheet);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${businessName} Dashboard`);
  const [folderId, setFolderId] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [tabs, setTabs] = useState<TabConfig[]>(DEFAULT_TABS);
  const folders = useQuery({
    queryKey: ["google-drive-folders"],
    queryFn: () => listFolders(),
    enabled: open,
    retry: false,
  });
  const folderMutation = useMutation({
    mutationFn: () => createFolder({ data: { name: newFolder, parentId: folderId || null } }),
    onSuccess: (folder: any) => {
      toast.success("Folder Drive dibuat");
      setFolderId(folder.id);
      setNewFolder("");
      qc.invalidateQueries({ queryKey: ["google-drive-folders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createSheet({
        data: {
          businessId,
          name,
          folderId: folderId || null,
          tabs: tabs.map((tab) => ({
            role: tab.role,
            name: tab.name.trim(),
            columns: tab.columnsText
              .split(",")
              .map((column) => column.trim())
              .filter(Boolean),
          })),
        },
      }),
    onSuccess: (result) => {
      toast.success("Spreadsheet berhasil dibuat di Google Drive");
      setOpen(false);
      qc.invalidateQueries();
      window.open(result.spreadsheetUrl, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setTab = (index: number, patch: Partial<TabConfig>) =>
    setTabs((current) => current.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <FilePlus2 className="mr-1 h-4 w-4" /> Buat Spreadsheet
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Buat spreadsheet custom</SheetTitle>
        </SheetHeader>
        <div className="mx-auto mt-4 max-w-3xl space-y-4">
          <div>
            <Label>Nama spreadsheet</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label>Folder Google Drive</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">My Drive (root)</option>
                {(folders.data?.folders ?? []).map((folder: any) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Folder baru</Label>
              <Input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="Nama folder"
              />
            </div>
            <Button
              className="self-end"
              variant="secondary"
              disabled={!newFolder.trim() || folderMutation.isPending}
              onClick={() => folderMutation.mutate()}
            >
              <FolderPlus className="mr-1 h-4 w-4" /> Buat
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Tab dan header kolom</div>
                <div className="text-xs text-muted-foreground">
                  Nama tab bebas. Role dipakai Faza OS untuk membaca dashboard.
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTabs((value) => [
                    ...value,
                    {
                      role: "extra",
                      name: `Tab ${value.length + 1}`,
                      columnsText: "column_1, column_2",
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Tab
              </Button>
            </div>
            {tabs.map((tab, index) => (
              <div
                key={`${tab.role}-${index}`}
                className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[130px_1fr_2fr_auto]"
              >
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={tab.role}
                  onChange={(e) => setTab(index, { role: e.target.value as TabConfig["role"] })}
                >
                  {["summary", "sales", "expenses", "products", "stock", "extra"].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <Input
                  value={tab.name}
                  onChange={(e) => setTab(index, { name: e.target.value })}
                  placeholder="Nama tab"
                />
                <Input
                  value={tab.columnsText}
                  onChange={(e) => setTab(index, { columnsText: e.target.value })}
                  placeholder="Kolom, dipisahkan koma"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={tabs.length === 1}
                  onClick={() => setTabs((value) => value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={
              createMutation.isPending ||
              !name.trim() ||
              tabs.some((tab) => !tab.name.trim() || !tab.columnsText.trim())
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Membuat di Drive..." : "Buat dan hubungkan spreadsheet"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
