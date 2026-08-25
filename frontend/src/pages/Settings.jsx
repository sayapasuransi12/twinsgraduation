import { useEffect, useState, useCallback } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Section({ title, desc, children, testid }) {
  return (
    <div className="border border-border rounded-md bg-card p-6 md:p-8" data-testid={testid}>
      <h2 className="font-display font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [site, setSite] = useState(null);
  const [biz, setBiz] = useState({ name: "", tagline: "", phone: "", email: "", address: "" });
  const [slots, setSlots] = useState("");
  const [methods, setMethods] = useState("");
  const [packages, setPackages] = useState([]);
  const [saving, setSaving] = useState("");

  const load = useCallback(() => {
    api.get("/settings").then((r) => {
      setSite(r.data);
      setBiz(r.data.business);
      setSlots((r.data.time_slots || []).join(", "));
      setMethods((r.data.payment_methods || []).join(", "));
      setPackages(r.data.packages || []);
    }).catch((e) => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSite = async (payload, key) => {
    setSaving(key);
    try {
      await api.patch("/settings", payload);
      toast.success("Pengaturan tersimpan");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(""); }
  };

  const savePackages = async () => {
    setSaving("packages");
    try {
      await api.put("/settings/packages", { packages });
      toast.success("Paket tersimpan");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(""); }
  };

  const setPkg = (i, k, v) => setPackages((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  if (!site) return <p className="text-muted-foreground" data-testid="settings-loading">Memuat pengaturan...</p>;

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit info bisnis, paket foto, dan opsi formulir booking — perubahan langsung tampil di halaman depan & invoice.
        </p>
      </div>

      <Section title="Info Bisnis" testid="settings-business"
        desc="Tampil di header/footer halaman booking, portal klien, dan kop invoice PDF.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nama Studio</Label><Input className="mt-1.5 rounded-sm" data-testid="set-biz-name" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></div>
          <div><Label>Tagline</Label><Input className="mt-1.5 rounded-sm" data-testid="set-biz-tagline" value={biz.tagline} onChange={(e) => setBiz({ ...biz, tagline: e.target.value })} /></div>
          <div><Label>Telepon / WhatsApp</Label><Input className="mt-1.5 rounded-sm" data-testid="set-biz-phone" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input className="mt-1.5 rounded-sm" data-testid="set-biz-email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Alamat</Label><Input className="mt-1.5 rounded-sm" data-testid="set-biz-address" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></div>
        </div>
        <Button className="mt-5 rounded-sm" data-testid="save-business-button" disabled={saving === "biz"}
          onClick={() => saveSite({ business: biz }, "biz")}>
          <Save className="w-4 h-4 mr-2" /> {saving === "biz" ? "Menyimpan..." : "Simpan Info Bisnis"}
        </Button>
      </Section>

      <Section title="Paket Foto" testid="settings-packages"
        desc="Paket tampil sebagai kartu di halaman booking dan jadi opsi di formulir (harga & DP terisi otomatis).">
        <div className="space-y-4">
          {packages.map((p, i) => (
            <div key={p.id || i} className="border border-border rounded-sm p-4 grid grid-cols-2 md:grid-cols-12 gap-3 items-end" data-testid={`package-row-${i}`}>
              <div className="col-span-2 md:col-span-3"><Label className="text-xs">Nama Paket</Label><Input className="mt-1.5 rounded-sm" data-testid={`pkg-name-${i}`} value={p.name} onChange={(e) => setPkg(i, "name", e.target.value)} /></div>
              <div className="md:col-span-2"><Label className="text-xs">Harga (Rp)</Label><Input type="number" min="0" className="mt-1.5 rounded-sm font-mono" data-testid={`pkg-price-${i}`} value={p.price} onChange={(e) => setPkg(i, "price", e.target.value)} /></div>
              <div className="md:col-span-2"><Label className="text-xs">Kuota Foto Edit</Label><Input type="number" min="1" className="mt-1.5 rounded-sm font-mono" data-testid={`pkg-quota-${i}`} value={p.quota} onChange={(e) => setPkg(i, "quota", e.target.value)} /></div>
              <div className="col-span-2 md:col-span-4"><Label className="text-xs">Deskripsi</Label><Input className="mt-1.5 rounded-sm" data-testid={`pkg-desc-${i}`} value={p.desc} onChange={(e) => setPkg(i, "desc", e.target.value)} /></div>
              <div className="md:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" data-testid={`pkg-delete-${i}`}
                  onClick={() => setPackages((ps) => ps.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="rounded-sm" data-testid="add-package-button"
            onClick={() => setPackages((ps) => [...ps, { id: "", name: "", price: "", quota: 20, desc: "" }])}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Paket
          </Button>
          <Button size="sm" className="rounded-sm" data-testid="save-packages-button" disabled={saving === "packages"} onClick={savePackages}>
            <Save className="w-4 h-4 mr-2" /> {saving === "packages" ? "Menyimpan..." : "Simpan Semua Paket"}
          </Button>
        </div>
      </Section>

      <Section title="Opsi Formulir Booking" testid="settings-form"
        desc="Pisahkan dengan koma. Langsung mengubah pilihan di form booking publik.">
        <div className="space-y-4">
          <div>
            <Label>Slot Waktu Sesi (contoh: 07:00, 09:00, 13:00)</Label>
            <Input className="mt-1.5 rounded-sm font-mono" data-testid="set-time-slots" value={slots} onChange={(e) => setSlots(e.target.value)} />
            <Button className="mt-3 rounded-sm" size="sm" data-testid="save-slots-button" disabled={saving === "slots"}
              onClick={() => saveSite({ time_slots: slots.split(",") }, "slots")}>
              <Save className="w-4 h-4 mr-2" /> Simpan Slot Waktu
            </Button>
          </div>
          <div className="border-t border-border pt-4">
            <Label>Metode Pembayaran (contoh: Transfer Bank, QRIS, Cash)</Label>
            <Input className="mt-1.5 rounded-sm" data-testid="set-payment-methods" value={methods} onChange={(e) => setMethods(e.target.value)} />
            <Button className="mt-3 rounded-sm" size="sm" data-testid="save-methods-button" disabled={saving === "methods"}
              onClick={() => saveSite({ payment_methods: methods.split(",") }, "methods")}>
              <Save className="w-4 h-4 mr-2" /> Simpan Metode Pembayaran
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
