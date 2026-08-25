import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ArrowRight, CheckCircle2, Copy, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { fmtIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/format";

const HERO = "https://images.pexels.com/photos/18269637/pexels-photo-18269637.jpeg?auto=compress&cs=tinysrgb&w=1600";
const TIME_SLOTS = ["07:00", "08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const EMPTY = {
  client_name: "", phone: "", instagram: "", package: "", booking_date: "",
  booking_time: "", location: "", total_price: "", dp_amount: "", payment_method: "", notes: "",
};

export default function Landing() {
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/public/packages").then((r) => setPackages(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickPackage = (p) => {
    setForm((f) => ({ ...f, package: p.name, total_price: p.price, dp_amount: Math.round(p.price * 0.5) }));
    document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        total_price: Number(form.total_price) || 0,
        dp_amount: Number(form.dp_amount) || 0,
      };
      const { data } = await api.post("/public/bookings", payload);
      setResult(data);
      toast.success("Booking berhasil dikirim!");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const portalLink = result ? `${window.location.origin}/portal/${result.portal_token}` : "";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="fixed top-0 inset-x-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3" data-testid="landing-logo">
            <span className="w-8 h-8 bg-gold text-black grid place-items-center rounded-sm">
              <Camera className="w-4 h-4" />
            </span>
            <span className="font-display font-semibold tracking-tight text-sm">TWINS GRADUATION</span>
          </div>
          <Link to="/login" data-testid="landing-login-link"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
            Masuk Admin
          </Link>
        </div>
      </header>

      <section className="relative pt-16">
        <div className="absolute inset-0">
          <img src={HERO} alt="Studio fotografi" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <p className="text-xs uppercase tracking-[0.3em] text-gold animate-fade-up">Studio Fotografi Wisuda & Event</p>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-display font-semibold tracking-tight max-w-2xl animate-fade-up">
            Abadikan momen kelulusan Anda, tanpa ribet.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl animate-fade-up">
            Pesan sesi foto, pantau jadwal, bayar, pilih foto untuk diedit — semua dari satu tempat.
          </p>
          <a href="#booking-form" data-testid="hero-cta"
            className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors animate-fade-up">
            Booking Sekarang <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Pilih Paket</h2>
        <p className="mt-2 text-sm text-muted-foreground">Klik paket untuk mengisi formulir secara otomatis.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((p, i) => (
            <button key={p.id} type="button" onClick={() => pickPackage(p)}
              data-testid={`package-card-${p.id}`}
              className={`text-left border rounded-md p-6 hover:-translate-y-1 transition-transform duration-200 animate-fade-up ${
                form.package === p.name ? "border-gold bg-gold/5" : "border-border bg-card"
              } ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-gold">{p.name}</p>
              <p className="mt-3 text-2xl font-display font-semibold font-mono">{fmtIDR(p.price)}</p>
              <p className="mt-3 text-sm text-muted-foreground">{p.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section id="booking-form" className="max-w-6xl mx-auto px-6 py-12">
        <div className="border border-border rounded-md bg-card p-6 md:p-10">
          {result ? (
            <div className="text-center py-8 animate-fade-up" data-testid="booking-success">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="mt-6 text-2xl md:text-3xl font-display font-semibold">Booking Terkirim!</h2>
              <p className="mt-3 text-muted-foreground">
                Nomor invoice Anda: <span className="font-mono text-foreground">{result.invoice_number}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Simpan tautan portal pribadi Anda untuk melihat jadwal, invoice, dan memilih foto:
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <code className="text-xs bg-muted px-4 py-2 rounded-sm break-all" data-testid="portal-link">{portalLink}</code>
                <Button variant="outline" size="sm" className="rounded-sm" data-testid="copy-portal-link"
                  onClick={() => { navigator.clipboard.writeText(portalLink); toast.success("Tautan disalin"); }}>
                  <Copy className="w-4 h-4 mr-2" /> Salin
                </Button>
              </div>
              <Button className="mt-8 rounded-sm" data-testid="booking-again-button"
                onClick={() => { setResult(null); setForm(EMPTY); }}>
                Buat Booking Baru
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Formulir Booking</h2>
              <p className="mt-2 text-sm text-muted-foreground">Isi detail sesi Anda. Tim kami akan menghubungi via WhatsApp untuk konfirmasi.</p>
              <form onSubmit={submit} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="booking-form">
                <div>
                  <Label htmlFor="client_name">Nama Lengkap</Label>
                  <Input id="client_name" data-testid="booking-client-name" required className="mt-2 rounded-sm"
                    value={form.client_name} onChange={(e) => set("client_name", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="phone">Nomor WhatsApp</Label>
                  <Input id="phone" data-testid="booking-phone" required placeholder="08xxxxxxxxxx" className="mt-2 rounded-sm"
                    value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="instagram">Username Instagram</Label>
                  <Input id="instagram" data-testid="booking-instagram" placeholder="tanpa @" className="mt-2 rounded-sm"
                    value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
                </div>
                <div>
                  <Label>Paket Fotografi</Label>
                  <Select value={form.package} onValueChange={(v) => {
                    const p = packages.find((x) => x.name === v);
                    setForm((f) => ({ ...f, package: v, total_price: p ? p.price : f.total_price }));
                  }}>
                    <SelectTrigger className="mt-2 rounded-sm" data-testid="booking-package">
                      <SelectValue placeholder="Pilih paket" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.name}>{p.name} — {fmtIDR(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="booking_date">Tanggal Booking</Label>
                  <Input id="booking_date" type="date" data-testid="booking-date" required className="mt-2 rounded-sm"
                    value={form.booking_date} onChange={(e) => set("booking_date", e.target.value)} />
                </div>
                <div>
                  <Label>Waktu Preferensi</Label>
                  <Select value={form.booking_time} onValueChange={(v) => set("booking_time", v)} required>
                    <SelectTrigger className="mt-2 rounded-sm" data-testid="booking-time">
                      <SelectValue placeholder="Pilih waktu" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((t) => <SelectItem key={t} value={t}>{t} WIB</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="location">Lokasi Sesi</Label>
                  <Input id="location" data-testid="booking-location" required placeholder="Contoh: Balairung UGM, Yogyakarta" className="mt-2 rounded-sm"
                    value={form.location} onChange={(e) => set("location", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="total_price">Total Harga Paket (Rp)</Label>
                  <Input id="total_price" type="number" min="0" data-testid="booking-total-price" required className="mt-2 rounded-sm font-mono"
                    value={form.total_price} onChange={(e) => set("total_price", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dp_amount">Uang Muka / DP (Rp)</Label>
                  <Input id="dp_amount" type="number" min="0" data-testid="booking-dp" className="mt-2 rounded-sm font-mono"
                    value={form.dp_amount} onChange={(e) => set("dp_amount", e.target.value)} />
                </div>
                <div>
                  <Label>Metode Pembayaran</Label>
                  <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                    <SelectTrigger className="mt-2 rounded-sm" data-testid="booking-payment-method">
                      <SelectValue placeholder="Pilih metode" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Catatan Booking</Label>
                  <Textarea id="notes" data-testid="booking-notes" rows={1} className="mt-2 rounded-sm"
                    value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>
                {form.total_price > 0 && (
                  <div className="md:col-span-2 border border-border rounded-sm p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm" data-testid="booking-summary">
                    <span className="text-muted-foreground">Total: <b className="text-foreground font-mono">{fmtIDR(Number(form.total_price))}</b></span>
                    <span className="text-muted-foreground">DP: <b className="text-gold font-mono">{fmtIDR(Number(form.dp_amount) || 0)}</b></span>
                    <span className="text-muted-foreground">Sisa: <b className="text-foreground font-mono">{fmtIDR(Math.max(Number(form.total_price) - (Number(form.dp_amount) || 0), 0))}</b></span>
                  </div>
                )}
                <div className="md:col-span-2">
                  <Button type="submit" disabled={loading} data-testid="booking-submit-button"
                    className="w-full md:w-auto rounded-sm px-10">
                    {loading ? "Mengirim..." : "Kirim Booking"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-border mt-8">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-4 justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gold" /> Jl. Kenanga No. 12, Yogyakarta</span>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> Setiap hari, 07.00 – 18.00 WIB</span>
        </div>
      </footer>
    </div>
  );
}
