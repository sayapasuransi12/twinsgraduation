import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fmtIDR, fmtDate, PAYMENT_METHODS, BOOKING_STATUS, PAYMENT_STATUS } from "@/lib/format";
import { BookingBadge, PaymentBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const EMPTY = {
  client_name: "", phone: "", instagram: "", package: "", booking_date: "", booking_time: "",
  location: "", total_price: "", dp_amount: "", payment_method: "Transfer Bank", notes: "",
};

export default function Bookings() {
  const { user } = useAuth();
  const canManage = ["owner", "admin"].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "all", payment_status: "all", photographer_id: "all", date_from: "", date_to: "" });
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params[k] = v; });
    api.get("/bookings", { params }).then((r) => setRows(r.data)).catch((e) => toast.error(formatApiError(e)));
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/photographers").then((r) => setPhotographers(r.data)).catch(() => {});
    api.get("/public/packages").then((r) => setPackages(r.data)).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/bookings", { ...form, total_price: Number(form.total_price) || 0, dp_amount: Number(form.dp_amount) || 0 });
      toast.success("Booking berhasil dibuat");
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6" data-testid="bookings-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Pemesanan</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} booking ditemukan.</p>
        </div>
        {canManage && (
          <Button className="rounded-sm" data-testid="new-booking-button" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Booking Baru
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="booking-filters">
        <div className="relative col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari nama / HP / no. invoice..." className="pl-9 rounded-sm" data-testid="filter-search"
            value={filters.search} onChange={(e) => setF("search", e.target.value)} />
        </div>
        <Select value={filters.status} onValueChange={(v) => setF("status", v)}>
          <SelectTrigger className="rounded-sm" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(BOOKING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.payment_status} onValueChange={(v) => setF("payment_status", v)}>
          <SelectTrigger className="rounded-sm" data-testid="filter-payment-status"><SelectValue placeholder="Pembayaran" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pembayaran</SelectItem>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.photographer_id} onValueChange={(v) => setF("photographer_id", v)}>
          <SelectTrigger className="rounded-sm" data-testid="filter-photographer"><SelectValue placeholder="Fotografer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Fotografer</SelectItem>
            {photographers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" className="rounded-sm" data-testid="filter-date-from" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          <Input type="date" className="rounded-sm" data-testid="filter-date-to" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-x-auto bg-card" data-testid="bookings-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead><TableHead>Klien</TableHead><TableHead>Jadwal</TableHead>
              <TableHead>Paket</TableHead><TableHead>Fotografer</TableHead><TableHead>Status</TableHead>
              <TableHead>Pembayaran</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/60" data-testid={`booking-row-${b.invoice_number}`}
                onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                <TableCell className="font-mono text-xs">{b.invoice_number}</TableCell>
                <TableCell>
                  <p className="font-medium">{b.client_name}</p>
                  <p className="text-xs text-muted-foreground">{b.phone}</p>
                </TableCell>
                <TableCell className="text-sm">{fmtDate(b.booking_date)}<br /><span className="text-xs text-muted-foreground">{b.booking_time} • {b.location}</span></TableCell>
                <TableCell className="text-sm">{b.package}</TableCell>
                <TableCell className="text-sm">{b.photographer_name || "—"}</TableCell>
                <TableCell><BookingBadge status={b.status} /></TableCell>
                <TableCell><PaymentBadge status={b.payment_status} /></TableCell>
                <TableCell className="text-right font-mono text-sm">{fmtIDR(b.remaining)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {canManage && (
                    <Button variant="ghost" size="icon" data-testid={`booking-delete-${b.invoice_number}`}
                      onClick={() => setDeleteTarget(b)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Tidak ada data.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-booking-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Hapus Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Booking {deleteTarget?.client_name} ({deleteTarget?.invoice_number}) beserta riwayat pembayarannya akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-booking-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-booking-confirm"
              onClick={async () => {
                try {
                  await api.delete(`/bookings/${deleteTarget.id}`);
                  toast.success("Booking dihapus");
                  setDeleteTarget(null);
                  load();
                } catch (e) { toast.error(formatApiError(e)); }
              }}>
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="new-booking-dialog">
          <DialogHeader><DialogTitle className="font-display">Booking Baru</DialogTitle></DialogHeader>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div><Label>Nama Klien</Label><Input required className="mt-1.5 rounded-sm" data-testid="nb-client-name" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
            <div><Label>No. WhatsApp</Label><Input required className="mt-1.5 rounded-sm" data-testid="nb-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label>Username IG</Label><Input className="mt-1.5 rounded-sm" data-testid="nb-instagram" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} /></div>
            <div>
              <Label>Paket</Label>
              <Select value={form.package} onValueChange={(v) => {
                const p = packages.find((x) => x.name === v);
                setForm((f) => ({ ...f, package: v, total_price: p ? p.price : f.total_price }));
              }}>
                <SelectTrigger className="mt-1.5 rounded-sm" data-testid="nb-package"><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {packages.map((p) => <SelectItem key={p.id} value={p.name}>{p.name} — {fmtIDR(p.price)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Tanggal</Label><Input type="date" required className="mt-1.5 rounded-sm" data-testid="nb-date" value={form.booking_date} onChange={(e) => set("booking_date", e.target.value)} /></div>
            <div><Label>Waktu</Label><Input type="time" required className="mt-1.5 rounded-sm" data-testid="nb-time" value={form.booking_time} onChange={(e) => set("booking_time", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Lokasi</Label><Input required className="mt-1.5 rounded-sm" data-testid="nb-location" value={form.location} onChange={(e) => set("location", e.target.value)} /></div>
            <div><Label>Total Harga (Rp)</Label><Input type="number" min="0" required className="mt-1.5 rounded-sm font-mono" data-testid="nb-total" value={form.total_price} onChange={(e) => set("total_price", e.target.value)} /></div>
            <div><Label>DP (Rp)</Label><Input type="number" min="0" className="mt-1.5 rounded-sm font-mono" data-testid="nb-dp" value={form.dp_amount} onChange={(e) => set("dp_amount", e.target.value)} /></div>
            <div>
              <Label>Metode Pembayaran</Label>
              <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger className="mt-1.5 rounded-sm" data-testid="nb-method"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Catatan</Label><Textarea rows={1} className="mt-1.5 rounded-sm" data-testid="nb-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <div className="md:col-span-2">
              <Button type="submit" className="rounded-sm" disabled={saving} data-testid="nb-submit">{saving ? "Menyimpan..." : "Simpan Booking"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
