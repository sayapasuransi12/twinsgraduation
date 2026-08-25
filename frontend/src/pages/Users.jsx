import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_LABEL = { owner: "Pemilik", admin: "Admin", photographer: "Fotografer" };
const EMPTY = { name: "", email: "", password: "", role: "photographer" };

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/users").then((r) => setRows(r.data)).catch((e) => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/users", form);
      toast.success("Pengguna dibuat");
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight">Pengguna</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola akun admin dan fotografer.</p>
        </div>
        <Button className="rounded-sm" data-testid="new-user-button" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Pengguna
        </Button>
      </div>

      <div className="border border-border rounded-md overflow-x-auto bg-card" data-testid="users-table">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Dibuat</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.email}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono text-sm">{u.email}</TableCell>
                <TableCell>
                  <span className="text-[10px] uppercase tracking-[0.15em] border border-border rounded-full px-2.5 py-0.5">
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{fmtDate((u.created_at || "").slice(0, 10))}</TableCell>
                <TableCell>
                  {u.id !== user?.id && u.role !== "owner" && (
                    <Button variant="ghost" size="icon" data-testid={`user-delete-${u.email}`}
                      onClick={async () => { await api.delete(`/users/${u.id}`); toast.success("Pengguna dihapus"); load(); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="new-user-dialog">
          <DialogHeader><DialogTitle className="font-display">Tambah Pengguna</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div><Label>Nama</Label><Input required className="mt-1.5 rounded-sm" data-testid="nu-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" required className="mt-1.5 rounded-sm" data-testid="nu-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Kata Sandi</Label><Input type="password" required minLength={8} className="mt-1.5 rounded-sm" data-testid="nu-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1.5 rounded-sm" data-testid="nu-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="photographer">Fotografer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="rounded-sm" disabled={saving} data-testid="nu-submit">{saving ? "Menyimpan..." : "Simpan"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
