import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Copy, FileText, Download, Printer, Send, Trash2, Plus, AlertTriangle, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { api, API, formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, BOOKING_STATUS, EDITING_STATUS, DELIVERY_STATUS, PAYMENT_METHODS } from "@/lib/format";
import { BookingBadge, PaymentBadge, ConflictBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Section({ title, children, testid, action }) {
  return (
    <div className="border border-border rounded-md bg-card p-6" data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [b, setB] = useState(null);
  const [photographers, setPhotographers] = useState([]);
  const [pay, setPay] = useState({ amount: "", method: "Transfer Bank", type: "dp", note: "" });
  const [driveInput, setDriveInput] = useState("");
  const [photoUrls, setPhotoUrls] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    api.get(`/bookings/${id}`).then((r) => {
      setB(r.data);
      setDriveInput(r.data.drive_link || "");
      setNotes(r.data.admin_notes || "");
    }).catch((e) => toast.error(formatApiError(e)));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role !== "photographer") api.get("/photographers").then((r) => setPhotographers(r.data)).catch(() => {});
  }, [user]);

  const patch = async (payload, msg = "Tersimpan") => {
    try {
      await api.patch(`/bookings/${id}`, payload);
      toast.success(msg);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/bookings/${id}/payments`, { ...pay, amount: Number(pay.amount) });
      toast.success("Pembayaran dicatat");
      setPay({ amount: "", method: "Transfer Bank", type: "pelunasan", note: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const addPhotos = async () => {
    const urls = photoUrls.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!urls.length) return;
    try {
      await api.post(`/bookings/${id}/photos`, { urls });
      toast.success(`${urls.length} foto ditambahkan`);
      setPhotoUrls("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const sendInvoice = async () => {
    try {
      await api.post(`/bookings/${id}/invoice/send`);
      toast.success("Invoice dikirim (simulasi) — lihat menu Notifikasi");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!b) return <p className="text-muted-foreground" data-testid="booking-detail-loading">Memuat booking...</p>;

  const canManage = ["owner", "admin"].includes(user?.role);
  const portalLink = `${window.location.origin}/portal/${b.portal_token}`;
  const selectedCount = (b.photos || []).filter((p) => p.selected).length;

  return (
    <div className="space-y-6" data-testid="booking-detail-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/bookings" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" data-testid="back-to-bookings">
            <ArrowLeft className="w-3 h-3" /> Kembali ke Pemesanan
          </Link>
          <h1 className="mt-2 text-3xl md:text-4xl font-display font-semibold tracking-tight">{b.client_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground font-mono">{b.invoice_number}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BookingBadge status={b.status} />
            <PaymentBadge status={b.payment_status} />
            {b.conflicts?.length > 0 && <ConflictBadge />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-sm" data-testid="preview-invoice-button" onClick={() => setInvoiceOpen(true)}>
            <FileText className="w-4 h-4 mr-2" /> Preview Invoice
          </Button>
          <Button variant="outline" size="sm" className="rounded-sm" data-testid="download-invoice-button"
            onClick={() => window.open(`${API}/bookings/${b.id}/invoice.pdf`, "_blank")}>
            <Download className="w-4 h-4 mr-2" /> Unduh PDF
          </Button>
          <Button variant="outline" size="sm" className="rounded-sm" data-testid="print-invoice-button"
            onClick={() => window.open(`${API}/bookings/${b.id}/invoice.pdf`, "_blank")}>
            <Printer className="w-4 h-4 mr-2" /> Cetak
          </Button>
          {canManage && (
            <Button size="sm" className="rounded-sm" data-testid="send-invoice-button" onClick={sendInvoice}>
              <Send className="w-4 h-4 mr-2" /> Kirim ke Klien
            </Button>
          )}
        </div>
      </div>

      {b.conflicts?.length > 0 && (
        <div className="border border-destructive rounded-md p-4 bg-destructive/5 flex items-start gap-3" data-testid="conflict-warning">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Jadwal bentrok terdeteksi</p>
            <p className="text-sm text-muted-foreground">
              Bentrok dengan: {b.conflicts.map((c) => `${c.client_name} (${c.booking_time})`).join(", ")} pada tanggal yang sama (selisih &lt; 2 jam).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Detail Booking" testid="section-details">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Telepon</dt><dd className="mt-0.5">{b.phone}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Instagram</dt><dd className="mt-0.5">{b.instagram ? `@${b.instagram}` : "—"}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Tanggal</dt><dd className="mt-0.5">{fmtDate(b.booking_date)}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Waktu</dt><dd className="mt-0.5">{b.booking_time} WIB</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground text-xs uppercase tracking-wider">Lokasi</dt><dd className="mt-0.5">{b.location}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Paket</dt><dd className="mt-0.5">{b.package}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Catatan Klien</dt><dd className="mt-0.5">{b.notes || "—"}</dd></div>
          </dl>
          {canManage && (
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5">
              <div>
                <Label className="text-xs">Status Booking</Label>
                <Select value={b.status} onValueChange={(v) => patch({ status: v }, "Status diperbarui")}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BOOKING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fotografer</Label>
                <Select value={b.photographer_id || "none"} onValueChange={(v) => patch({ photographer_id: v === "none" ? "" : v }, "Fotografer ditugaskan")}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="photographer-select"><SelectValue placeholder="Belum ditugaskan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ditugaskan</SelectItem>
                    {photographers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tanggal</Label>
                <Input type="date" className="mt-1.5 rounded-sm" data-testid="edit-date" value={b.booking_date}
                  onChange={(e) => patch({ booking_date: e.target.value }, "Jadwal diubah")} />
              </div>
              <div>
                <Label className="text-xs">Waktu</Label>
                <Input type="time" className="mt-1.5 rounded-sm" data-testid="edit-time" value={b.booking_time}
                  onChange={(e) => patch({ booking_time: e.target.value }, "Jadwal diubah")} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Pembayaran" testid="section-payment">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-border rounded-sm p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p><p className="mt-1 font-mono font-semibold" data-testid="summary-total">{fmtIDR(b.total_price)}</p></div>
            <div className="border border-border rounded-sm p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">DP</p><p className="mt-1 font-mono text-gold" data-testid="summary-dp">{fmtIDR(b.dp_amount)}</p></div>
            <div className="border border-border rounded-sm p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Terbayar</p><p className="mt-1 font-mono text-success" data-testid="summary-paid">{fmtIDR(b.paid_amount)}</p></div>
            <div className="border border-border rounded-sm p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Sisa</p><p className="mt-1 font-mono text-destructive" data-testid="summary-remaining">{fmtIDR(b.remaining)}</p></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Jatuh tempo: <span className="text-foreground">{fmtDate(b.payment_deadline)}</span> • Metode: {b.payment_method || "—"}
          </p>
          {canManage && (
            <form onSubmit={addPayment} className="mt-4 border-t border-border pt-4 grid grid-cols-2 gap-3" data-testid="payment-form">
              <div><Label className="text-xs">Jumlah (Rp)</Label><Input type="number" min="1" required className="mt-1.5 rounded-sm font-mono" data-testid="pay-amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Metode</Label>
                <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="pay-method"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Jenis</Label>
                <Select value={pay.type} onValueChange={(v) => setPay({ ...pay, type: v })}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="pay-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dp">DP</SelectItem>
                    <SelectItem value="pelunasan">Pelunasan</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Catatan</Label><Input className="mt-1.5 rounded-sm" data-testid="pay-note" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>
              <div className="col-span-2">
                <Button type="submit" size="sm" className="rounded-sm" data-testid="pay-submit"><Plus className="w-4 h-4 mr-2" /> Catat Pembayaran</Button>
              </div>
            </form>
          )}
          <div className="mt-4 space-y-2" data-testid="payment-history">
            {(b.payments || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-border rounded-sm px-3 py-2 text-sm" data-testid={`payment-${p.id}`}>
                <div>
                  <p className="font-mono">{fmtIDR(p.amount)} <span className="text-xs text-muted-foreground font-sans">({p.type})</span></p>
                  <p className="text-xs text-muted-foreground">{fmtDate(p.date)} • {p.method}{p.note ? ` • ${p.note}` : ""}</p>
                </div>
                {user?.role === "owner" && (
                  <Button variant="ghost" size="icon" data-testid={`payment-delete-${p.id}`}
                    onClick={async () => { await api.delete(`/bookings/${b.id}/payments/${p.id}`); toast.success("Pembayaran dihapus"); load(); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {(b.payments || []).length === 0 && <p className="text-xs text-muted-foreground">Belum ada riwayat pembayaran.</p>}
          </div>
        </Section>

        <Section title="Galeri & Seleksi Foto" testid="section-photos"
          action={<span className="text-xs font-mono text-gold" data-testid="photo-counter">Terpilih: {selectedCount} / {b.photo_quota} Foto</span>}>
          {canManage && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Link Folder Google Drive</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input className="rounded-sm" placeholder="https://drive.google.com/drive/folders/..." data-testid="drive-link-input"
                    value={driveInput} onChange={(e) => setDriveInput(e.target.value)} />
                  <Button variant="outline" size="sm" className="rounded-sm shrink-0" data-testid="drive-link-save"
                    onClick={() => patch({ drive_link: driveInput }, "Link Drive tersimpan")}>Simpan</Button>
                </div>
                {b.drive_link && (
                  <a href={b.drive_link} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-gold hover:underline" data-testid="drive-link-open">
                    Buka folder Drive <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div>
                <Label className="text-xs">Tambah Foto (satu URL per baris)</Label>
                <Textarea rows={2} className="mt-1.5 rounded-sm font-mono text-xs" data-testid="photo-urls-input"
                  value={photoUrls} onChange={(e) => setPhotoUrls(e.target.value)} placeholder="https://..." />
                <Button variant="outline" size="sm" className="mt-2 rounded-sm" data-testid="add-photos-button" onClick={addPhotos}>
                  <Plus className="w-4 h-4 mr-2" /> Tambah Foto
                </Button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Status seleksi: {b.selection_submitted ? <span className="text-success font-medium">Sudah dikirim klien</span> : "Menunggu klien memilih"}
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="admin-photo-grid">
            {(b.photos || []).map((p) => (
              <div key={p.id} className={`relative border rounded-sm overflow-hidden ${p.selected ? "border-gold ring-1 ring-gold" : "border-border"}`} data-testid={`admin-photo-${p.id}`}>
                <img src={p.url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                {p.selected && <span className="absolute top-1 left-1 bg-gold text-black text-[9px] px-1.5 py-0.5 rounded-sm font-medium uppercase">Dipilih</span>}
                {canManage && (
                  <button className="absolute top-1 right-1 bg-black/60 rounded-sm p-0.5" data-testid={`photo-delete-${p.id}`}
                    onClick={async () => { await api.delete(`/bookings/${b.id}/photos/${p.id}`); load(); }}>
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                )}
                {p.note && <p className="text-[10px] p-1.5 text-muted-foreground truncate" title={p.note}>{p.note}</p>}
              </div>
            ))}
            {(b.photos || []).length === 0 && <p className="text-xs text-muted-foreground col-span-full">Belum ada foto. Tambahkan URL foto atau link Drive di atas.</p>}
          </div>
        </Section>

        <Section title="Editing & Pengiriman" testid="section-editing">
          {canManage ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status Editing</Label>
                <Select value={b.editing_status} onValueChange={(v) => patch({ editing_status: v }, "Status editing diperbarui")}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="editing-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EDITING_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status Pengiriman</Label>
                <Select value={b.delivery_status} onValueChange={(v) => patch({ delivery_status: v }, "Status pengiriman diperbarui")}>
                  <SelectTrigger className="mt-1.5 rounded-sm" data-testid="delivery-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DELIVERY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Catatan Internal Admin</Label>
                <Textarea rows={3} className="mt-1.5 rounded-sm" data-testid="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button variant="outline" size="sm" className="mt-2 rounded-sm" data-testid="admin-notes-save"
                  onClick={() => patch({ admin_notes: notes }, "Catatan tersimpan")}>Simpan Catatan</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm space-y-2">
              <p>Editing: <span className="text-gold">{EDITING_STATUS[b.editing_status]}</span></p>
              <p>Pengiriman: <span className="text-gold">{DELIVERY_STATUS[b.delivery_status]}</span></p>
            </div>
          )}
          <div className="mt-5 border-t border-border pt-4">
            <Label className="text-xs">Portal Klien</Label>
            <div className="mt-1.5 flex gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-sm truncate" data-testid="portal-link-text">{portalLink}</code>
              <Button variant="outline" size="sm" className="rounded-sm shrink-0" data-testid="copy-portal-button"
                onClick={() => { navigator.clipboard.writeText(portalLink); toast.success("Tautan portal disalin"); }}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-sm shrink-0" data-testid="open-portal-button"
                onClick={() => window.open(portalLink, "_blank")}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-2xl" data-testid="invoice-preview-dialog">
          <DialogHeader><DialogTitle className="font-display">Preview Invoice</DialogTitle></DialogHeader>
          <div className="border border-border rounded-sm overflow-hidden">
            <div className="bg-black text-white p-6">
              <p className="text-gold font-display font-bold text-lg">{b.business?.name?.toUpperCase()}</p>
              <p className="text-xs text-neutral-300 mt-1">{b.business?.phone} | {b.business?.email}</p>
              <div className="mt-4 flex justify-between items-end">
                <span className="text-2xl font-display font-bold text-gold">INVOICE</span>
                <span className="font-mono text-sm">{b.invoice_number}</span>
              </div>
            </div>
            <div className="p-6 text-sm space-y-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tagihan kepada</p>
                  <p className="font-semibold mt-1">{b.client_name}</p>
                  <p className="text-muted-foreground">{b.phone}</p>
                </div>
                <PaymentBadge status={b.payment_status} />
              </div>
              <div className="border-t border-border pt-4 flex justify-between">
                <div>
                  <p className="font-medium">{b.package}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(b.booking_date)} {b.booking_time} • {b.location}</p>
                </div>
                <p className="font-mono">{fmtIDR(b.total_price)}</p>
              </div>
              <div className="border-t border-border pt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>DP</span><span className="font-mono">{fmtIDR(b.dp_amount)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Terbayar</span><span className="font-mono text-success">{fmtIDR(b.paid_amount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Sisa Pembayaran</span><span className="font-mono">{fmtIDR(b.remaining)}</span></div>
                <p className="text-xs text-muted-foreground pt-2">Jatuh tempo: {fmtDate(b.payment_deadline)} • Metode: {b.payment_method || "—"}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
