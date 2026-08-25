import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { fmtIDR, fmtDate, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const iso = (d) => d.toISOString().slice(0, 10);
const EMPTY = { date: iso(new Date()), name: "", category: "Operasional", amount: "", method: "Cash", description: "", receipt_url: "" };

export default function Expenses() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/expenses").then((r) => setRows(r.data)).catch((e) => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((s, e) => s + e.amount, 0);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount) });
      toast.success("Pengeluaran dicatat");
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

  return (
    <div className="space-y-6" data-testid="expenses-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Pengeluaran</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total tercatat: <span className="font-mono text-foreground" data-testid="expenses-total">{fmtIDR(total)}</span>
          </p>
        </div>
        <Button className="rounded-sm" data-testid="new-expense-button" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Pengeluaran
        </Button>
      </div>

      <div className="border border-border rounded-md overflow-x-auto bg-card" data-testid="expenses-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead><TableHead>Nama</TableHead><TableHead>Kategori</TableHead>
              <TableHead>Metode</TableHead><TableHead>Deskripsi</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                <TableCell>{fmtDate(e.date)}</TableCell>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>
                  <span className="text-[10px] uppercase tracking-[0.15em] border border-border rounded-full px-2.5 py-0.5">{e.category}</span>
                </TableCell>
                <TableCell>{e.method}</TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate">{e.description || "—"}</TableCell>
                <TableCell className="text-right font-mono">{fmtIDR(e.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" data-testid={`expense-delete-${e.id}`}
                    onClick={async () => { await api.delete(`/expenses/${e.id}`); toast.success("Dihapus"); load(); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Belum ada pengeluaran.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="new-expense-dialog">
          <DialogHeader><DialogTitle className="font-display">Tambah Pengeluaran</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid grid-cols-2 gap-4 mt-2">
            <div><Label>Tanggal</Label><Input type="date" required className="mt-1.5 rounded-sm" data-testid="exp-date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div><Label>Nama Pengeluaran</Label><Input required className="mt-1.5 rounded-sm" data-testid="exp-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="mt-1.5 rounded-sm" data-testid="exp-category"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Jumlah (Rp)</Label><Input type="number" min="1" required className="mt-1.5 rounded-sm font-mono" data-testid="exp-amount" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
            <div>
              <Label>Metode Pembayaran</Label>
              <Select value={form.method} onValueChange={(v) => set("method", v)}>
                <SelectTrigger className="mt-1.5 rounded-sm" data-testid="exp-method"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>URL Bukti/Nota</Label><Input className="mt-1.5 rounded-sm" data-testid="exp-receipt" placeholder="https://..." value={form.receipt_url} onChange={(e) => set("receipt_url", e.target.value)} /></div>
            <div className="col-span-2"><Label>Deskripsi</Label><Textarea rows={2} className="mt-1.5 rounded-sm" data-testid="exp-description" value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="col-span-2">
              <Button type="submit" className="rounded-sm" disabled={saving} data-testid="exp-submit">{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
