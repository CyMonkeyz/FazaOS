import { useBusiness } from "@/contexts/BusinessContext";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";

export function BusinessSelector() {
  const {
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    isAllBusinesses,
    selectedBusiness,
  } = useBusiness();

  if (businesses.length === 0) {
    return (
      <Card className="p-3 border-dashed">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Store className="h-4 w-4" />
          Belum ada bisnis. Buat toko pertama Tuan di tab <b className="mx-1">Toko</b>.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-primary shrink-0" />
        <div className="text-xs text-muted-foreground shrink-0">Toko aktif</div>
        <div className="ml-auto min-w-[160px]">
          <Select
            value={selectedBusinessId ?? "__all__"}
            onValueChange={(v) => setSelectedBusinessId(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Semua Bisnis</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!isAllBusinesses && selectedBusiness?.description && (
        <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">
          {selectedBusiness.description}
        </div>
      )}
      {isAllBusinesses && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Menampilkan agregat semua bisnis. Pilih satu bisnis untuk menambah data.
        </div>
      )}
    </Card>
  );
}
