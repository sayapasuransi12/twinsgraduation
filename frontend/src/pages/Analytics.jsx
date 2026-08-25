import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, AlertCircle, Repeat } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api } from "@/lib/api";
import { fmtIDR } from "@/lib/format";
import StatCard from "@/components/StatCard";

const MONTH_ID = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mei", "06": "Jun", "07": "Jul", "08": "Agu", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des" };

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/analytics").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <p className="text-muted-foreground" data-testid="analytics-loading">Memuat analitik...</p>;

  const monthly = data.monthly.map((m) => ({ ...m, label: MONTH_ID[m.month.slice(5)] || m.month }));

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Analitik Bisnis</h1>
        <p className="mt-1 text-sm text-muted-foreground">Performa studio 12 bulan terakhir.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard testid="an-avg" label="Rata-rata Nilai Booking" value={fmtIDR(data.avg_booking_value)} icon={BarChart3} mono />
        <StatCard testid="an-total" label="Total Booking" value={data.total_bookings} icon={TrendingUp} />
        <StatCard testid="an-outstanding" label="Total Piutang" value={fmtIDR(data.outstanding)} icon={AlertCircle} mono />
        <StatCard testid="an-repeat" label="Klien Repeat Order" value={data.repeat_clients.length} icon={Repeat} />
      </div>

      <div className="border border-border rounded-md bg-card p-6" data-testid="analytics-monthly-chart">
        <h2 className="font-display font-semibold">Pendapatan, Pengeluaran & Laba per Bulan</h2>
        <div className="mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}jt` : `${v / 1000}rb`} />
              <Tooltip formatter={(v) => fmtIDR(v)}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 4, color: "hsl(var(--popover-foreground))" }} />
              <Legend />
              <Bar dataKey="revenue" name="Pendapatan" fill="hsl(var(--gold))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" name="Pengeluaran" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="profit" name="Laba" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-md bg-card p-6" data-testid="analytics-packages">
          <h2 className="font-display font-semibold">Performa Paket</h2>
          <div className="mt-4 space-y-3">
            {data.packages.map((p) => (
              <div key={p.package} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0" data-testid={`pkg-${p.package}`}>
                <div>
                  <p className="font-medium text-sm">{p.package}</p>
                  <p className="text-xs text-muted-foreground">{p.count} booking</p>
                </div>
                <p className="font-mono text-sm">{fmtIDR(p.revenue)}</p>
              </div>
            ))}
            {data.packages.length === 0 && <p className="text-sm text-muted-foreground">Belum ada data.</p>}
          </div>
        </div>

        <div className="border border-border rounded-md bg-card p-6" data-testid="analytics-photographers">
          <h2 className="font-display font-semibold">Pendapatan per Fotografer</h2>
          <div className="mt-4 space-y-3">
            {data.by_photographer.map((p) => (
              <div key={p.name} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.count} sesi</p>
                </div>
                <p className="font-mono text-sm">{fmtIDR(p.revenue)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-md bg-card p-6" data-testid="analytics-locations">
          <h2 className="font-display font-semibold">Pendapatan per Lokasi</h2>
          <div className="mt-4 space-y-3">
            {data.by_location.map((l) => (
              <div key={l.name} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0">
                <div>
                  <p className="font-medium text-sm">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.count} sesi</p>
                </div>
                <p className="font-mono text-sm">{fmtIDR(l.revenue)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-md bg-card p-6" data-testid="analytics-repeat">
          <h2 className="font-display font-semibold">Klien Repeat Order</h2>
          <div className="mt-4 space-y-3">
            {data.repeat_clients.map((c) => (
              <div key={c.phone} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.phone}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] border border-gold text-gold rounded-full px-2.5 py-0.5">
                  {c.count}x booking
                </span>
              </div>
            ))}
            {data.repeat_clients.length === 0 && <p className="text-sm text-muted-foreground">Belum ada klien yang repeat order.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
