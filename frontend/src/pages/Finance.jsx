import { useEffect, useState, useCallback } from "react";
import { Wallet, HandCoins, AlertCircle, Receipt, TrendingUp, CheckCircle2, Hourglass } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { fmtIDR, fmtDate } from "@/lib/format";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const iso = (d) => d.toISOString().slice(0, 10);

const PRESETS = [
  { key: "day", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "year", label: "Tahun Ini" },
  { key: "custom", label: "Kustom" },
];

function presetRange(key) {
  const today = new Date();
  if (key === "day") return { from: iso(today), to: iso(today), g: "day" };
  if (key === "week") {
    const d = new Date(today); d.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: iso(d), to: iso(today), g: "day" };
  }
  if (key === "month") return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today), g: "day" };
  if (key === "year") return { from: `${today.getFullYear()}-01-01`, to: iso(today), g: "month" };
  return null;
}

export default function Finance() {
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    const range = preset === "custom"
      ? (custom.from && custom.to ? { from: custom.from, to: custom.to, g: "day" } : null)
      : presetRange(preset);
    if (!range) return;
    api.get("/finance/summary", { params: { date_from: range.from, date_to: range.to, granularity: range.g } })
      .then((r) => setData(r.data)).catch(() => {});
  }, [preset, custom]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="finance-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Keuangan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pendapatan, piutang, pengeluaran, dan laba bersih.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="finance-filters">
          {PRESETS.map((p) => (
            <Button key={p.key} variant={preset === p.key ? "default" : "outline"} size="sm" className="rounded-sm"
              data-testid={`filter-${p.key}`} onClick={() => setPreset(p.key)}>
              {p.label}
            </Button>
          ))}
          {preset === "custom" && (
            <>
              <Input type="date" className="rounded-sm w-auto" data-testid="custom-from" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              <Input type="date" className="rounded-sm w-auto" data-testid="custom-to" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </>
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard testid="fin-revenue" label="Pendapatan" value={fmtIDR(data.revenue)} icon={Wallet} mono sub={`${data.payments_count} transaksi`} />
            <StatCard testid="fin-dp" label="DP Diterima" value={fmtIDR(data.dp_received)} icon={HandCoins} mono />
            <StatCard testid="fin-outstanding" label="Sisa Belum Dibayar" value={fmtIDR(data.outstanding)} icon={AlertCircle} mono sub={`${data.unpaid_count} booking`} />
            <StatCard testid="fin-expenses" label="Pengeluaran" value={fmtIDR(data.total_expenses)} icon={Receipt} mono />
            <StatCard testid="fin-net" label="Laba Bersih" value={fmtIDR(data.net_income)} icon={TrendingUp} mono />
            <StatCard testid="fin-paid-count" label="Booking Lunas" value={data.fully_paid_count} icon={CheckCircle2} />
            <StatCard testid="fin-unpaid-count" label="Belum Lunas" value={data.unpaid_count} icon={Hourglass} />
          </div>

          <div className="border border-border rounded-md bg-card p-6" data-testid="finance-chart">
            <h2 className="font-display font-semibold">Pendapatan vs Pengeluaran</h2>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${v / 1000}rb`} />
                  <Tooltip formatter={(v) => fmtIDR(v)}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, color: "hsl(var(--popover-foreground))" }} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Pendapatan" stroke="hsl(var(--gold))" fill="hsl(var(--gold))" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="expenses" name="Pengeluaran" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-border rounded-md bg-card overflow-x-auto" data-testid="recent-payments">
            <div className="p-6 pb-2"><h2 className="font-display font-semibold">Transaksi Terakhir</h2></div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tanggal</TableHead><TableHead>Jumlah</TableHead><TableHead>Jenis</TableHead><TableHead>Metode</TableHead><TableHead>Catatan</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_payments.map((p) => (
                  <TableRow key={p.id} data-testid={`recent-payment-${p.id}`}>
                    <TableCell>{fmtDate(p.date)}</TableCell>
                    <TableCell className="font-mono">{fmtIDR(p.amount)}</TableCell>
                    <TableCell className="capitalize">{p.type}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                  </TableRow>
                ))}
                {data.recent_payments.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada transaksi pada rentang ini.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
