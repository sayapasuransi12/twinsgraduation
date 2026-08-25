import { useEffect, useState, useCallback } from "react";
import { Bell, CalendarClock, HandCoins, AlertCircle, Scissors, Send, FileText, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const TYPE_META = {
  booking_baru: { icon: BookOpen, label: "Booking Baru" },
  pembayaran_diterima: { icon: HandCoins, label: "Pembayaran" },
  pengingat_sesi: { icon: CalendarClock, label: "Pengingat Sesi" },
  dp_belum_bayar: { icon: AlertCircle, label: "DP Belum Bayar" },
  sisa_belum_lunas: { icon: AlertCircle, label: "Sisa Pembayaran" },
  pemilihan_foto: { icon: Scissors, label: "Seleksi Foto" },
  pengiriman_final: { icon: Send, label: "Pengiriman Final" },
  invoice_terkirim: { icon: FileText, label: "Invoice" },
};

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    api.get("/notifications").then((r) => setRows(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const runChecks = async () => {
    setRunning(true);
    try {
      const { data } = await api.post("/notifications/run-checks");
      toast.success(`${data.created} pengingat baru dibuat`);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Notifikasi & Pengingat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Antrean pesan otomatis — siap diintegrasikan ke WhatsApp / email.
          </p>
        </div>
        <Button className="rounded-sm" data-testid="run-checks-button" onClick={runChecks} disabled={running}>
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} /> Jalankan Pengecekan
        </Button>
      </div>

      <div className="space-y-3" data-testid="notifications-list">
        {rows.length === 0 && (
          <div className="border border-border rounded-md bg-card p-10 text-center text-sm text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="mt-3">Belum ada notifikasi. Klik "Jalankan Pengecekan" untuk memindai pengingat.</p>
          </div>
        )}
        {rows.map((n) => {
          const meta = TYPE_META[n.type] || { icon: Bell, label: n.type };
          return (
            <div key={n.id} className="border border-border rounded-md bg-card p-4 flex items-start gap-4 animate-fade-up"
              data-testid={`notification-${n.id}`}>
              <span className="w-9 h-9 border border-border rounded-sm grid place-items-center shrink-0">
                <meta.icon className="w-4 h-4 text-gold" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-sm">{n.title}</p>
                  <span className="text-[10px] uppercase tracking-[0.15em] border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                    {meta.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.15em] border border-warning text-warning rounded-full px-2 py-0.5">
                    {n.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground/70 font-mono">
                  {new Date(n.created_at).toLocaleString("id-ID")} • kanal: {n.channel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
