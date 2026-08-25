import { BOOKING_STATUS, PAYMENT_STATUS } from "@/lib/format";

function Pill({ cls, label, testid }) {
  return (
    <span data-testid={testid}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export function BookingBadge({ status, testid }) {
  const s = BOOKING_STATUS[status] || { label: status, cls: "border-muted-foreground text-muted-foreground" };
  return <Pill cls={s.cls} label={s.label} testid={testid || `booking-status-${status}`} />;
}

export function PaymentBadge({ status, testid }) {
  const s = PAYMENT_STATUS[status] || { label: status, cls: "border-muted-foreground text-muted-foreground" };
  return <Pill cls={s.cls} label={s.label} testid={testid || `payment-status-${status}`} />;
}

export function ConflictBadge() {
  return <Pill cls="bg-destructive text-destructive-foreground border-destructive" label="Bentrok" testid="conflict-badge" />;
}
