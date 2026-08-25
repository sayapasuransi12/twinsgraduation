export const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d) => {
  if (!d) return "-";
  const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const fmtDateShort = (d) => {
  if (!d) return "-";
  const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export const BOOKING_STATUS = {
  pending: { label: "Menunggu", cls: "border-warning text-warning" },
  confirmed: { label: "Terkonfirmasi", cls: "border-foreground/50 text-foreground" },
  dp_paid: { label: "DP Terbayar", cls: "border-gold text-gold" },
  fully_paid: { label: "Lunas", cls: "border-success text-success" },
  completed: { label: "Selesai", cls: "bg-success/10 border-success text-success" },
  cancelled: { label: "Dibatalkan", cls: "border-destructive text-destructive" },
  rescheduled: { label: "Dijadwal Ulang", cls: "border-muted-foreground text-muted-foreground" },
};

export const PAYMENT_STATUS = {
  belum: { label: "Belum Bayar", cls: "border-destructive text-destructive" },
  dp: { label: "DP", cls: "border-gold text-gold" },
  lunas: { label: "Lunas", cls: "border-success text-success" },
};

export const EXPENSE_CATEGORIES = [
  "Transportasi", "Peralatan", "Marketing", "Studio",
  "Staff/Fotografer", "Editing", "Software", "Operasional", "Lainnya",
];

export const PAYMENT_METHODS = ["Transfer Bank", "Cash", "QRIS", "E-Wallet"];

export const EDITING_STATUS = {
  menunggu_seleksi: "Menunggu Seleksi",
  antre_edit: "Antre Edit",
  sedang_diedit: "Sedang Diedit",
  selesai: "Selesai Edit",
};

export const DELIVERY_STATUS = {
  belum: "Belum Dikirim",
  diproses: "Diproses",
  terkirim: "Terkirim",
};
