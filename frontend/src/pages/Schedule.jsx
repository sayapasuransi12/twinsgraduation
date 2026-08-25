import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { BookingBadge, ConflictBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_DOT = {
  pending: "bg-warning", confirmed: "bg-foreground", dp_paid: "bg-gold",
  fully_paid: "bg-success", completed: "bg-success", cancelled: "bg-destructive", rescheduled: "bg-muted-foreground",
};

const iso = (d) => d.toISOString().slice(0, 10);

function rangeOf(view, cursor) {
  if (view === "day") return [iso(cursor), iso(cursor)];
  if (view === "week") {
    const day = (cursor.getDay() + 6) % 7;
    const start = new Date(cursor); start.setDate(cursor.getDate() - day);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return [iso(start), iso(end)];
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return [iso(start), iso(end)];
}

export default function Schedule() {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const navigate = useNavigate();

  const [start, end] = useMemo(() => rangeOf(view, cursor), [view, cursor]);

  useEffect(() => {
    api.get("/schedule", { params: { start, end } }).then((r) => setBookings(r.data)).catch(() => {});
  }, [start, end]);

  const move = (dir) => {
    const d = new Date(cursor);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const title = view === "month"
    ? cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : view === "week" ? `Minggu ${fmtDate(start)}` : fmtDate(iso(cursor));

  const byDate = useMemo(() => {
    const m = {};
    bookings.forEach((b) => { (m[b.booking_date] = m[b.booking_date] || []).push(b); });
    return m;
  }, [bookings]);

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysIn = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const [s] = rangeOf("week", cursor);
    const startD = new Date(`${s}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startD); d.setDate(startD.getDate() + i); return d;
    });
  }, [cursor]);

  const Chip = ({ b, compact }) => (
    <button key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)}
      data-testid={`schedule-booking-${b.invoice_number}`}
      className={`w-full text-left flex items-center gap-1.5 rounded-sm border border-border bg-card hover:bg-muted transition-colors ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.status] || "bg-muted-foreground"}`} />
      <span className="truncate">{b.booking_time} {b.client_name}</span>
      {b.conflict && <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" title="Bentrok" />}
    </button>
  );

  return (
    <div className="space-y-6" data-testid="schedule-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Jadwal Pemotretan</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList data-testid="schedule-view-tabs">
              <TabsTrigger value="day" data-testid="view-day">Hari</TabsTrigger>
              <TabsTrigger value="week" data-testid="view-week">Minggu</TabsTrigger>
              <TabsTrigger value="month" data-testid="view-month">Bulan</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" className="rounded-sm" data-testid="schedule-prev" onClick={() => move(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-sm" data-testid="schedule-today" onClick={() => setCursor(new Date())}>
            Hari Ini
          </Button>
          <Button variant="outline" size="icon" className="rounded-sm" data-testid="schedule-next" onClick={() => move(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {view === "month" && (
        <div className="border border-border rounded-md overflow-hidden" data-testid="calendar-month">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{d}</div>
            ))}
          </div>
          {weeks.map((row, i) => (
            <div key={i} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {row.map((day, j) => {
                const key = day ? iso(new Date(cursor.getFullYear(), cursor.getMonth(), day)) : null;
                const items = key ? byDate[key] || [] : [];
                return (
                  <div key={j} className={`min-h-[90px] md:min-h-[110px] border-r border-border last:border-r-0 p-1.5 ${day ? "bg-background" : "bg-muted/30"}`}>
                    {day && (
                      <>
                        <p className={`text-xs font-mono ${key === iso(new Date()) ? "text-gold font-bold" : "text-muted-foreground"}`}>{day}</p>
                        <div className="mt-1 space-y-1">
                          {items.slice(0, 3).map((b) => <Chip key={b.id} b={b} compact />)}
                          {items.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{items.length - 3} lainnya</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3" data-testid="calendar-week">
          {weekDays.map((d) => {
            const key = iso(d);
            const items = byDate[key] || [];
            return (
              <div key={key} className="border border-border rounded-md p-3 min-h-[140px] bg-card">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {d.toLocaleDateString("id-ID", { weekday: "short" })}
                </p>
                <p className={`font-mono text-sm ${key === iso(new Date()) ? "text-gold font-bold" : ""}`}>{d.getDate()}</p>
                <div className="mt-2 space-y-1.5">
                  {items.map((b) => <Chip key={b.id} b={b} />)}
                  {items.length === 0 && <p className="text-[10px] text-muted-foreground">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <div className="space-y-3" data-testid="calendar-day">
          {(byDate[iso(cursor)] || []).length === 0 && (
            <p className="text-sm text-muted-foreground border border-border rounded-md p-6 bg-card">Tidak ada sesi pada hari ini.</p>
          )}
          {(byDate[iso(cursor)] || []).map((b) => (
            <button key={b.id} onClick={() => navigate(`/admin/bookings/${b.id}`)}
              data-testid={`day-booking-${b.invoice_number}`}
              className="w-full text-left border border-border rounded-md bg-card p-5 hover:-translate-y-0.5 transition-transform">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-semibold text-lg">{b.client_name}</p>
                <div className="flex items-center gap-2">
                  {b.conflict && <ConflictBadge />}
                  <BookingBadge status={b.status} />
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {b.booking_time} WIB • {b.package} • {b.location} • Fotografer: {b.photographer_name || "Belum ditugaskan"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
