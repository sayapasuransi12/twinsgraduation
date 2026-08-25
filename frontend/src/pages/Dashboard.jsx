import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, CalendarDays, CalendarClock, CheckCircle2, Hourglass, Wallet,
  HandCoins, AlertCircle, Receipt, TrendingUp, Users, Scissors,
} from "lucide-react";
import { api } from "@/lib/api";
import { fmtIDR, fmtDate } from "@/lib/format";
import StatCard from "@/components/StatCard";
import { BookingBadge, PaymentBadge } from "@/components/StatusBadge";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <p className="text-muted-foreground" data-testid="dashboard-loading">Memuat dasbor...</p>;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Dasbor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan seluruh operasional studio.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard testid="stat-total-bookings" label="Total Booking" value={stats.total_bookings} icon={BookOpen} />
        <StatCard testid="stat-today" label="Booking Hari Ini" value={stats.today_bookings} icon={CalendarDays} />
        <StatCard testid="stat-upcoming" label="Akan Datang" value={stats.upcoming_count} icon={CalendarClock} />
        <StatCard testid="stat-completed" label="Selesai" value={stats.completed} icon={CheckCircle2} />
        <StatCard testid="stat-pending" label="Menunggu" value={stats.pending} icon={Hourglass} />
        <StatCard testid="stat-revenue" label="Total Pendapatan" value={fmtIDR(stats.total_revenue)} icon={Wallet} mono />
        <StatCard testid="stat-dp" label="DP Diterima" value={fmtIDR(stats.dp_received)} icon={HandCoins} mono />
        <StatCard testid="stat-outstanding" label="Piutang / Sisa" value={fmtIDR(stats.outstanding)} icon={AlertCircle} mono />
        <StatCard testid="stat-expenses" label="Total Pengeluaran" value={fmtIDR(stats.total_expenses)} icon={Receipt} mono />
        <StatCard testid="stat-profit" label="Laba Bersih" value={fmtIDR(stats.net_profit)} icon={TrendingUp} mono
          sub={stats.net_profit >= 0 ? "Pendapatan - pengeluaran" : "Sedang defisit"} />
        <StatCard testid="stat-clients" label="Jumlah Klien" value={stats.clients} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border border-border rounded-md bg-card p-6" data-testid="upcoming-list">
          <h2 className="font-display font-semibold">Sesi Terdekat</h2>
          <div className="mt-4 space-y-3">
            {stats.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Belum ada sesi mendatang.</p>}
            {stats.upcoming.map((b) => (
              <Link key={b.id} to={`/admin/bookings/${b.id}`} data-testid={`upcoming-${b.invoice_number}`}
                className="block border border-border rounded-sm p-3 hover:bg-muted transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{b.client_name}</p>
                  <BookingBadge status={b.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDate(b.booking_date)} • {b.booking_time} • {b.location}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-md bg-card p-6" data-testid="overdue-list">
          <h2 className="font-display font-semibold">Pembayaran Jatuh Tempo</h2>
          <div className="mt-4 space-y-3">
            {stats.overdue.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada tunggakan.</p>}
            {stats.overdue.map((b) => (
              <Link key={b.id} to={`/admin/bookings/${b.id}`} data-testid={`overdue-${b.invoice_number}`}
                className="block border border-border rounded-sm p-3 hover:bg-muted transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{b.client_name}</p>
                  <PaymentBadge status={b.payment_status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sisa <span className="font-mono text-foreground">{fmtIDR(b.remaining)}</span> • tempo {fmtDate(b.payment_deadline)}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-md bg-card p-6" data-testid="photo-queue-list">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <Scissors className="w-4 h-4 text-gold" /> Antrean Editing
          </h2>
          <div className="mt-4 space-y-3">
            {stats.photo_queue.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada antrean editing.</p>}
            {stats.photo_queue.map((b) => (
              <Link key={b.id} to={`/admin/bookings/${b.id}`} data-testid={`queue-${b.invoice_number}`}
                className="block border border-border rounded-sm p-3 hover:bg-muted transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{b.client_name}</p>
                  <span className="text-xs font-mono text-gold">
                    {(b.photos || []).filter((p) => p.selected).length} foto
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.package}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
