import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Selamat datang, ${user.name}`);
      navigate(user.role === "photographer" ? "/admin/jadwal" : "/admin");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground grid place-items-center px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex items-center gap-3 justify-center">
          <span className="w-9 h-9 bg-gold text-black grid place-items-center rounded-sm">
            <Camera className="w-4 h-4" />
          </span>
          <span className="font-display font-semibold tracking-tight">TWINS GRADUATION</span>
        </div>
        <div className="mt-8 border border-border rounded-md bg-card p-8">
          <h1 className="text-xl font-display font-semibold">Masuk Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Khusus pemilik, admin, dan fotografer.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required data-testid="login-email" className="mt-2 rounded-sm"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input id="password" type="password" required data-testid="login-password" className="mt-2 rounded-sm"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="login-error">{error}</p>
            )}
            <Button type="submit" className="w-full rounded-sm" disabled={loading} data-testid="login-submit-button">
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors" data-testid="back-to-home">← Kembali ke halaman booking</Link>
        </p>
      </div>
    </div>
  );
}
