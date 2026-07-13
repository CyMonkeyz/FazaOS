import {
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const tabs = [
  {
    name: "Summary",
    purpose: "Angka utama dashboard",
    headers: "key | value",
    example: "revenue | 25000000\nexpenses | 15000000\nprofit | 10000000\ntransactions | 125",
  },
  {
    name: "Sales",
    purpose: "Grafik dan histori omzet",
    headers: "date | order_id | product | quantity | total",
    example: "2026-07-13 | ORD-001 | Kopi Susu | 2 | 50000",
  },
  {
    name: "Expenses",
    purpose: "Rincian biaya bisnis",
    headers: "date | category | description | amount",
    example: "2026-07-13 | Operasional | Beli kemasan | 250000",
  },
  {
    name: "Products",
    purpose: "Daftar produk",
    headers: "sku | name | category | price | cost",
    example: "SKU-001 | Kopi Susu | Minuman | 25000 | 12000",
  },
  {
    name: "Stock",
    purpose: "Stok dan batas stok rendah",
    headers: "sku | product | stock | min_stock | unit",
    example: "SKU-001 | Kopi Susu | 40 | 10 | cup",
  },
] as const;

function CodeLine({ children }: { children: string }) {
  return (
    <code className="block whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-5 text-emerald-200">
      {children}
    </code>
  );
}

export function SheetUsageGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-auto min-h-9 whitespace-normal text-left"
        >
          <BookOpenCheck className="mr-2 h-4 w-4 shrink-0" />
          Ketentuan dan Penggunaan Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl overflow-hidden rounded-2xl p-0 sm:w-full">
        <DialogHeader className="border-b bg-gradient-to-r from-emerald-500/10 via-card to-primary/10 px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-emerald-400" /> Panduan Google Sheets
          </DialogTitle>
          <DialogDescription>
            Ikuti format ini agar dashboard bisnis dapat membaca data tanpa error.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(92dvh-98px)]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-semibold">Aman dan view-only</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Faza OS hanya membaca spreadsheet. Program tidak mengubah atau menghapus isi
                    Sheet. Spreadsheet tidak perlu dibuat publik, tetapi akun Google yang terhubung
                    ke server harus memiliki akses lihat.
                  </p>
                </div>
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["prepare", "structure", "connect"]}>
              <AccordionItem value="prepare">
                <AccordionTrigger>1. Persiapan spreadsheet</AccordionTrigger>
                <AccordionContent className="space-y-3 text-xs leading-5 text-muted-foreground">
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>Buat satu Google Spreadsheet untuk satu toko atau bisnis.</li>
                    <li>
                      Nama file bebas, misalnya{" "}
                      <b className="text-foreground">Faza OS - Toko Utama</b>.
                    </li>
                    <li>
                      Buat tepat lima tab: <b className="text-foreground">Summary</b>,{" "}
                      <b className="text-foreground">Sales</b>,{" "}
                      <b className="text-foreground">Expenses</b>,{" "}
                      <b className="text-foreground">Products</b>, dan{" "}
                      <b className="text-foreground">Stock</b>.
                    </li>
                    <li>
                      Nama tab peka huruf besar-kecil. Jangan diterjemahkan atau diberi spasi
                      tambahan.
                    </li>
                    <li>
                      Baris pertama setiap tab wajib berisi header, data dimulai dari baris kedua.
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="structure">
                <AccordionTrigger>2. Struktur tab dan header wajib</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {tabs.map((tab) => (
                    <div key={tab.name} className="rounded-xl border bg-card/70 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                        <div className="font-semibold text-foreground">{tab.name}</div>
                        <div className="text-[11px] text-muted-foreground">{tab.purpose}</div>
                      </div>
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                        Header
                      </div>
                      <CodeLine>{tab.headers}</CodeLine>
                      <div className="mb-1 mt-2 text-[11px] font-medium text-muted-foreground">
                        Contoh data
                      </div>
                      <CodeLine>{tab.example}</CodeLine>
                    </div>
                  ))}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Nilai <b className="text-foreground">expenses</b> dan{" "}
                    <b className="text-foreground">profit</b> pada Summary dapat memakai formula,
                    misalnya <code>=SUM(Expenses!D2:D)</code> dan <code>=B2-B3</code>.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="rules">
                <AccordionTrigger>3. Aturan format data</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                    {[
                      "Gunakan tanggal YYYY-MM-DD, contoh 2026-07-13.",
                      "Simpan nominal sebagai angka, bukan teks Rp 50.000.",
                      "Format mata uang bawaan Google Sheets tetap boleh dipakai.",
                      "Jangan merge cell pada header atau area data.",
                      "Jangan membuat header kosong atau nama header ganda.",
                      "Data dibaca dari kolom A-Z dan maksimal 5.000 baris per tab.",
                    ].map((rule) => (
                      <div key={rule} className="flex gap-2 rounded-lg bg-muted/30 p-2.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        {rule}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="connect">
                <AccordionTrigger>4. Cara menghubungkan ke Faza OS</AccordionTrigger>
                <AccordionContent className="space-y-3 text-xs leading-5 text-muted-foreground">
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>
                      Buka tab <b className="text-foreground">Kelola Toko</b> dan buat toko.
                    </li>
                    <li>Pilih toko tersebut melalui pemilih bisnis di bagian atas.</li>
                    <li>
                      Kembali ke tab <b className="text-foreground">Dashboard</b>.
                    </li>
                    <li>
                      Klik <b className="text-foreground">Hubungkan Sheet</b>.
                    </li>
                    <li>Tempel URL lengkap Google Spreadsheet atau spreadsheet ID.</li>
                    <li>
                      Klik <b className="text-foreground">Simpan koneksi</b>.
                    </li>
                    <li>Tunggu sinkronisasi otomatis, maksimal sekitar 15 menit.</li>
                  </ol>
                  <CodeLine>https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit</CodeLine>
                  <p>
                    Setelah berhasil, periksa status koneksi dan waktu terakhir sinkron. Perubahan
                    di Sheet akan masuk pada siklus sinkronisasi berikutnya.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="errors">
                <AccordionTrigger>5. Jika terjadi error</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-xs leading-5">
                    {[
                      [
                        "Izin ditolak",
                        "Pastikan akun Google server memiliki akses lihat dan Google Sheets API sudah aktif.",
                      ],
                      [
                        "Spreadsheet tidak ditemukan",
                        "Periksa URL/ID, pastikan file belum dihapus, dan aksesnya tidak dicabut.",
                      ],
                      [
                        "Tab tidak ditemukan",
                        "Gunakan nama Summary, Sales, Expenses, Products, dan Stock secara persis.",
                      ],
                      [
                        "Dashboard bernilai nol",
                        "Periksa key pada Summary dan pastikan nilainya berupa angka.",
                      ],
                      [
                        "Grafik kosong",
                        "Pastikan Sales mempunyai kolom date dan total serta minimal satu baris data.",
                      ],
                      [
                        "Status error",
                        "Baca pesan error di dashboard. Snapshot terakhir tetap aman dan tidak dihapus.",
                      ],
                    ].map(([title, description]) => (
                      <div
                        key={title}
                        className="rounded-lg border border-amber-400/15 bg-amber-400/5 p-3"
                      >
                        <div className="flex items-center gap-2 font-medium text-amber-200">
                          <TriangleAlert className="h-3.5 w-3.5" /> {title}
                        </div>
                        <p className="mt-1 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <a
              href="https://docs.google.com/spreadsheets/"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buka Google Sheets <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <ScrollBar />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
