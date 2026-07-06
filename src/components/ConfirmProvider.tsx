import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
};

type PendingConfirm = Required<ConfirmOptions> & {
  resolve: (ok: boolean) => void;
};

const ConfirmContext = createContext<((options?: ConfirmOptions) => Promise<boolean>) | null>(null);

const defaults: Required<ConfirmOptions> = {
  title: "Konfirmasi tindakan",
  description: "Tindakan ini akan mengubah atau menghapus data. Lanjutkan?",
  confirmText: "Ya, lanjutkan",
  cancelText: "Batal",
  tone: "danger",
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...defaults, ...options, resolve });
    });
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => !open && close(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{pending?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{pending?.description}</p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => close(false)}>
              {pending?.cancelText}
            </Button>
            <Button
              variant={pending?.tone === "danger" ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {pending?.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm harus dipakai di dalam ConfirmProvider.");
  return confirm;
}
