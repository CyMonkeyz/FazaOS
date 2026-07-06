import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { Calculator, Percent } from "lucide-react";

function parseNum(v: string) {
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
}

export function HppCalculator() {
  const [bahan, setBahan] = useState("0");
  const [kemasan, setKemasan] = useState("0");
  const [tenaga, setTenaga] = useState("0");
  const [overhead, setOverhead] = useState("0");
  const [unit, setUnit] = useState("1");
  const [marginPct, setMarginPct] = useState("40");

  const hpp = useMemo(() => {
    const total = parseNum(bahan) + parseNum(kemasan) + parseNum(tenaga) + parseNum(overhead);
    const u = Math.max(1, parseNum(unit));
    return total / u;
  }, [bahan, kemasan, tenaga, overhead, unit]);
  const margin = parseNum(marginPct) / 100;
  const hargaJual = hpp * (1 + margin);
  const laba = hargaJual - hpp;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-primary" />
        <div className="font-medium text-sm">HPP Calculator</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bahan Baku</Label>
          <Input inputMode="decimal" value={bahan} onChange={(e) => setBahan(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Kemasan</Label>
          <Input inputMode="decimal" value={kemasan} onChange={(e) => setKemasan(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tenaga Kerja</Label>
          <Input inputMode="decimal" value={tenaga} onChange={(e) => setTenaga(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Overhead</Label>
          <Input
            inputMode="decimal"
            value={overhead}
            onChange={(e) => setOverhead(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Jumlah Unit</Label>
          <Input inputMode="numeric" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Margin (%)</Label>
          <Input
            inputMode="decimal"
            value={marginPct}
            onChange={(e) => setMarginPct(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted p-2">
          <div className="text-[10px] text-muted-foreground">HPP / unit</div>
          <div className="font-semibold text-sm mt-0.5">{formatIDR(hpp)}</div>
        </div>
        <div className="rounded-lg bg-primary/10 p-2">
          <div className="text-[10px] text-muted-foreground">Harga Jual</div>
          <div className="font-semibold text-sm mt-0.5 text-primary">{formatIDR(hargaJual)}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-2">
          <div className="text-[10px] text-muted-foreground">Laba / unit</div>
          <div className="font-semibold text-sm mt-0.5 text-emerald-600 dark:text-emerald-400">
            {formatIDR(laba)}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PromoSimulator() {
  const [harga, setHarga] = useState("100000");
  const [hpp, setHpp] = useState("60000");
  const [diskon, setDiskon] = useState("15");
  const [targetUnit, setTargetUnit] = useState("50");
  const [normalUnit, setNormalUnit] = useState("30");

  const p = parseNum(harga);
  const h = parseNum(hpp);
  const d = parseNum(diskon) / 100;
  const hargaPromo = p * (1 - d);
  const labaNormal = (p - h) * parseNum(normalUnit);
  const labaPromo = (hargaPromo - h) * parseNum(targetUnit);
  const selisih = labaPromo - labaNormal;
  const beMinimal = h > 0 && hargaPromo > h ? Math.ceil(labaNormal / (hargaPromo - h)) : Infinity;
  const marginPromo = hargaPromo > 0 ? ((hargaPromo - h) / hargaPromo) * 100 : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="h-4 w-4 text-primary" />
        <div className="font-medium text-sm">Promo Simulator</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Harga Normal</Label>
          <Input inputMode="decimal" value={harga} onChange={(e) => setHarga(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">HPP / unit</Label>
          <Input inputMode="decimal" value={hpp} onChange={(e) => setHpp(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Diskon (%)</Label>
          <Input inputMode="decimal" value={diskon} onChange={(e) => setDiskon(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Unit Normal/hari</Label>
          <Input
            inputMode="numeric"
            value={normalUnit}
            onChange={(e) => setNormalUnit(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Target Unit dengan Promo</Label>
          <Input
            inputMode="numeric"
            value={targetUnit}
            onChange={(e) => setTargetUnit(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Harga Promo</span>
          <span className="font-medium">{formatIDR(hargaPromo)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Margin Promo</span>
          <span
            className={`font-medium ${marginPromo < 15 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {marginPromo.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Laba Normal</span>
          <span className="font-medium">{formatIDR(labaNormal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Laba Promo</span>
          <span className="font-medium">{formatIDR(labaPromo)}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Selisih Laba</span>
          <span
            className={`font-semibold ${selisih >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
          >
            {selisih >= 0 ? "+" : ""}
            {formatIDR(selisih)}
          </span>
        </div>
        <div className="rounded-lg bg-muted p-2 mt-2">
          <div className="text-[10px] text-muted-foreground">Break-Even Minimum (unit promo)</div>
          <div className="font-semibold text-sm mt-0.5">
            {isFinite(beMinimal) ? `${beMinimal} unit` : "Tidak bisa BEP (harga < HPP)"}
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={() => {
          setHarga("100000");
          setHpp("60000");
          setDiskon("15");
          setTargetUnit("50");
          setNormalUnit("30");
        }}
      >
        Reset
      </Button>
    </Card>
  );
}

export function ToolsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <HppCalculator />
      <PromoSimulator />
    </div>
  );
}
