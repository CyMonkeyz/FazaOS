export function formatIDR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rp0";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function parseAmount(input: string): number {
  const cleaned = input.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateID(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(dateStr: string | null | undefined): string {
  const d = daysUntil(dateStr);
  if (d === null) return "—";
  if (d < 0) return `Terlambat ${Math.abs(d)}h`;
  if (d === 0) return "Hari ini";
  if (d === 1) return "H-1";
  if (d <= 7) return `H-${d}`;
  return formatDateID(dateStr!);
}
