import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Schedule from "@/pages/Schedule";
import Bookings from "@/pages/Bookings";
import BookingDetail from "@/pages/BookingDetail";
import Finance from "@/pages/Finance";
import Expenses from "@/pages/Expenses";
import Analytics from "@/pages/Analytics";
import Notifications from "@/pages/Notifications";
import UsersPage from "@/pages/Users";
import SettingsPage from "@/pages/Settings";
import ClientPortal from "@/pages/ClientPortal";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center bg-background" data-testid="auth-loading">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to={user.role === "photographer" ? "/admin/jadwal" : "/admin"} replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/portal/:token" element={<ClientPortal />} />
          <Route path="/admin" element={<Protected><Layout /></Protected>}>
            <Route index element={<Protected roles={["owner", "admin"]}><Dashboard /></Protected>} />
            <Route path="jadwal" element={<Schedule />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="keuangan" element={<Protected roles={["owner"]}><Finance /></Protected>} />
            <Route path="pengeluaran" element={<Protected roles={["owner"]}><Expenses /></Protected>} />
            <Route path="analitik" element={<Protected roles={["owner"]}><Analytics /></Protected>} />
            <Route path="notifikasi" element={<Protected roles={["owner", "admin"]}><Notifications /></Protected>} />
            <Route path="pengguna" element={<Protected roles={["owner"]}><UsersPage /></Protected>} />
            <Route path="pengaturan" element={<Protected roles={["owner"]}><SettingsPage /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

export default App;
