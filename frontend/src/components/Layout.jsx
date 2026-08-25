import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, CalendarDays, BookOpen, Wallet, Receipt, BarChart3,
  Bell, Users, LogOut, Sun, Moon, Menu, X, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { key: "dasbor", to: "/admin", end: true, label: "Dasbor", icon: LayoutDashboard, roles: ["owner", "admin"] },
  { key: "jadwal", to: "/admin/jadwal", label: "Jadwal Pemotretan", icon: CalendarDays, roles: ["owner", "admin", "photographer"] },
  { key: "bookings", to: "/admin/bookings", label: "Pemesanan", icon: BookOpen, roles: ["owner", "admin", "photographer"] },
  { key: "keuangan", to: "/admin/keuangan", label: "Keuangan", icon: Wallet, roles: ["owner"] },
  { key: "pengeluaran", to: "/admin/pengeluaran", label: "Pengeluaran", icon: Receipt, roles: ["owner"] },
  { key: "analitik", to: "/admin/analitik", label: "Analitik", icon: BarChart3, roles: ["owner"] },
  { key: "notifikasi", to: "/admin/notifikasi", label: "Notifikasi", icon: Bell, roles: ["owner", "admin"] },
  { key: "pengguna", to: "/admin/pengguna", label: "Pengguna", icon: Users, roles: ["owner"] },
];

const ROLE_LABEL = { owner: "Pemilik", admin: "Admin", photographer: "Fotografer" };

function SidebarContent({ user, onNavigate, suffix = "" }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <Link to="/admin" data-testid="sidebar-logo" onClick={onNavigate}
        className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
        <span className="w-8 h-8 bg-gold text-black grid place-items-center rounded-sm">
          <Camera className="w-4 h-4" />
        </span>
        <span className="font-display font-semibold tracking-tight text-sm leading-tight">
          TWINS GRADUATION
        </span>
      </Link>
      <nav className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
        {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
          <NavLink key={n.key} to={n.to} end={n.end} onClick={onNavigate}
            data-testid={`nav-${n.key}${suffix}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors duration-150 ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`
            }>
            <n.icon className="w-4 h-4 shrink-0" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        Sistem Operasional Studio
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden md:block fixed inset-y-0 left-0 w-[220px] border-r border-border z-30">
        <SidebarContent user={user} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] border-r border-border">
            <Button variant="ghost" size="icon" data-testid="sidebar-close-button"
              className="absolute top-3 right-3 z-10" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
            <SidebarContent user={user} onNavigate={() => setOpen(false)} suffix="-mobile" />
          </div>
        </div>
      )}

      <div className="md:ml-[220px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" data-testid="sidebar-open-button" onClick={() => setOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-display font-medium text-sm hidden sm:block text-muted-foreground">
              {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" data-testid="theme-toggle" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-medium leading-tight" data-testid="user-name">{user.name}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gold" data-testid="user-role">
                {ROLE_LABEL[user.role] || user.role}
              </span>
            </div>
            <Button variant="outline" size="sm" data-testid="logout-button" onClick={handleLogout} className="rounded-sm">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
