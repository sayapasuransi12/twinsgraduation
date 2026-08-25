import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Camera, Check, Download, Printer, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { api, API, formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, EDITING_STATUS, DELIVERY_STATUS } from "@/lib/format";
import { BookingBadge, PaymentBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function driveFolderId(link) {
  if (!link) return null;
  const m = link.match(/folders\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export default function ClientPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notes, setNotes] = useState({});
  const [manualLabel, setManualLabel] = useState("");

  const load = useCallback(() => {
    api.get(`/portal/${token}`)
      .then((r) => {
        setData(r.data);
        const n = {};
        (r.data.booking.photos || []).forEach((p) => { n[p.id] = p.note || ""; });
        setNotes(n);
      })
      .catch((e) => setError(formatApiError(e, "Booking tidak ditemukan.")));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (photo) => {
    try {
      await api.post(`/portal/${token}/photos/${photo.id}`, { selected: !photo.selected });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const saveNote = async (photo) => {
    try {
      await api.post(`/portal/${token}/photos/${photo.id}`, { selected: photo.selected, note: notes[photo.id] || "" });
      toast.success("Catatan tersimpan");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const addManual = async () => {
    if (!manualLabel.trim()) return;
    try {
      await api.post(`/portal/${token}/photos/manual`, { label: manualLabel.trim() });
      toast.success(`${manualLabel.trim()} ditambahkan ke pilihan`);
      setManualLabel("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const submitSelection = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const { data: res } = await api.post(`/portal/${token}/submit-selection`);
      toast.success(`${res.selected} foto dikirim untuk diedit`);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return (
    <div className="dark min-h-screen bg-background text-foreground grid place-items-center px-4">
      <p className="text-muted-foreground" data-testid="portal-error">{error}</p>
    </div>
  );
  if (!data) return (
    <div className="dark min-h-screen bg-background grid place-items-center">
      <p className="text-muted-foreground" data-testid="portal-loading">Memuat portal...</p>
    </div>
  );

  const { booking: b, business, selected_count } = data;
  const photos = b.photos || [];
  const folderId = driveFolderId(b.drive_link);
  const locked = b.selection_submitted;

  return (
    <div className="dark min-h-screen bg-background text-foreground" data-testid="client-portal">
      <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-gold text-black grid place-items-center rounded-sm"><Camera className="w-4 h-4" /></span>
            <span className="font-display font-semibold tracking-tight text-sm">{business.name.toUpperCase()}</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{b.invoice_number}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section className="animate-fade-up">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Portal Klien</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-display font-semibold tracking-tight">Halo, {b.client_name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <BookingBadge status={b.status} />
            <PaymentBadge status={b.payment_status} />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border rounded-md bg-card p-6 md:p-8" data-testid="portal-booking-details">
            <h2 className="font-display font-semibold">Detail Sesi</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Paket</dt><dd className="text-right">{b.package}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tanggal</dt><dd className="text-right">{fmtDate(b.booking_date)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Waktu</dt><dd className="text-right">{b.booking_time} WIB</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Lokasi</dt><dd className="text-right">{b.location}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fotografer</dt><dd className="text-right">{b.photographer_name || "Menyusul"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Status Editing</dt><dd className="text-right text-gold">{EDITING_STATUS[b.editing_status]}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pengiriman Final</dt><dd className="text-right text-gold">{DELIVERY_STATUS[b.delivery_status]}</dd></div>
            </dl>
          </div>

          <div className="border border-border rounded-md bg-card p-6 md:p-8" data-testid="portal-payment">
            <h2 className="font-display font-semibold">Pembayaran</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Paket</span><span className="font-mono">{fmtIDR(b.total_price)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span className="font-mono text-success">{fmtIDR(b.paid_amount)}</span></div>
              <div className="flex justify-between font-semibold"><span>Sisa Pembayaran</span><span className="font-mono text-gold">{fmtIDR(b.remaining)}</span></div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gold transition-all duration-500" style={{ width: `${b.total_price ? Math.min(100, (b.paid_amount / b.total_price) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                Jatuh tempo: {fmtDate(b.payment_deadline)} • Metode: {b.payment_method || "—"}
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="rounded-sm" data-testid="portal-download-invoice"
                  onClick={() => window.open(`${API}/portal/${token}/invoice.pdf`, "_blank")}>
                  <Download className="w-4 h-4 mr-2" /> Unduh Invoice
                </Button>
                <Button variant="outline" size="sm" className="rounded-sm" data-testid="portal-print-invoice"
                  onClick={() => window.open(`${API}/portal/${token}/invoice.pdf`, "_blank")}>
                  <Printer className="w-4 h-4 mr-2" /> Cetak
                </Button>
              </div>
            </div>
          </div>
        </section>

        {b.drive_link && (
          <section className="border border-border rounded-md bg-card p-6 md:p-8" data-testid="portal-drive-gallery">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display font-semibold">Galeri Foto (Google Drive)</h2>
              <a href={b.drive_link} target="_blank" rel="noreferrer" data-testid="portal-drive-link"
                className="text-xs text-gold hover:underline inline-flex items-center gap-1">
                Buka di Google Drive <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {folderId ? (
              <>
                <div className="mt-4 border border-border rounded-sm overflow-hidden bg-black">
                  <iframe title="Galeri Google Drive" data-testid="drive-embed"
                    src={`https://drive.google.com/embeddedfolderview?id=${folderId}#grid`}
                    className="w-full h-[420px]" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Jika galeri tidak tampil (folder privat), gunakan tombol "Buka di Google Drive" di atas.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground border border-border rounded-sm p-4" data-testid="drive-invalid-note">
                Tautan Drive tidak dapat disematkan. Gunakan tombol "Buka di Google Drive" di atas.
              </p>
            )}
          </section>
        )}

        {photos.length > 0 && (
          <section data-testid="portal-photo-selection">
            <div className="sticky top-16 z-30 border border-border rounded-md bg-background/90 backdrop-blur-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Pilih Foto untuk Diedit</h2>
                <p className="text-xs text-muted-foreground">Klik foto untuk memilih / batal memilih. Tambahkan catatan bila perlu.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gold" data-testid="selection-counter">
                  Terpilih: {selected_count} / {b.photo_quota} Foto
                </span>
                {!locked && (
                  <Button size="sm" className="rounded-sm" data-testid="submit-selection-button"
                    onClick={() => setConfirmOpen(true)} disabled={submitting || selected_count === 0}>
                    <Send className="w-4 h-4 mr-2" /> {submitting ? "Mengirim..." : "Kirim Seleksi Final"}
                  </Button>
                )}
              </div>
            </div>

            {locked && (
              <p className="mt-4 text-sm text-success border border-success/40 rounded-md p-4" data-testid="selection-submitted-note">
                Seleksi foto Anda sudah dikirim. Tim kami sedang memproses editing.
              </p>
            )}

            {!locked && (
              <div className="mt-6 border border-border rounded-md bg-card p-4 flex flex-col sm:flex-row gap-3 sm:items-end" data-testid="manual-photo-add">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">Tambah nomor foto manual</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lihat nama file di galeri Google Drive di atas (mis. DSC06265), lalu masukkan di sini.
                  </p>
                  <Input className="mt-2 rounded-sm font-mono" placeholder="DSC06265" data-testid="manual-photo-input"
                    value={manualLabel} onChange={(e) => setManualLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManual())} />
                </div>
                <Button variant="outline" className="rounded-sm shrink-0" data-testid="manual-photo-button" onClick={addManual}>
                  <Check className="w-4 h-4 mr-2" /> Pilih Foto Ini
                </Button>
              </div>
            )}

            <div className="mt-6 columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {photos.map((p) => (
                <div key={p.id} className="break-inside-avoid animate-fade-up" data-testid={`portal-photo-${p.id}`}>
                  <button type="button" onClick={() => !locked && toggle(p)} disabled={locked}
                    data-testid={`portal-photo-toggle-${p.id}`}
                    className={`relative block w-full overflow-hidden rounded-sm border-2 transition-colors duration-200 ${
                      p.selected ? "border-gold" : "border-transparent hover:border-muted-foreground/40"
                    }`}>
                    {p.url ? (
                      <img src={p.url} alt="" className={`w-full object-cover transition-[filter] duration-200 ${p.selected ? "" : "hover:brightness-110"}`} loading="lazy" />
                    ) : (
                      <div className="aspect-square grid place-items-center bg-muted px-2">
                        <span className="font-mono text-sm text-center break-all">{p.label}</span>
                      </div>
                    )}
                    {p.selected && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-gold text-black grid place-items-center rounded-sm">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                  {(p.selected || p.note) && (
                    <div className="mt-2 flex gap-2">
                      <Input className="rounded-sm h-8 text-xs" placeholder="Catatan edit (mis. hitam putih)"
                        data-testid={`portal-photo-note-${p.id}`} disabled={locked}
                        value={notes[p.id] || ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                      {!locked && (
                        <Button variant="outline" size="sm" className="rounded-sm h-8 shrink-0" data-testid={`portal-photo-note-save-${p.id}`}
                          onClick={() => saveNote(p)}>OK</Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-border pt-8 pb-4 text-xs text-muted-foreground">
          {business.name} • {business.phone} • {business.email}
        </footer>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="submit-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Kirim Seleksi Final?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected_count} foto akan dikirim untuk diedit. Setelah dikirim, pilihan tidak dapat diubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="submit-confirm-cancel">Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="submit-confirm-ok" onClick={submitSelection}>Ya, Kirim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
