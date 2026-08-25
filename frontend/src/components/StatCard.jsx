export default function StatCard({ label, value, icon: Icon, sub, testid, mono = false }) {
  return (
    <div data-testid={testid}
      className="border border-border rounded-md p-5 bg-card hover:-translate-y-0.5 transition-transform duration-200 animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-gold shrink-0" />}
      </div>
      <p title={value} className={`mt-3 text-base sm:text-xl md:text-2xl font-semibold tracking-tight truncate ${mono ? "font-mono" : "font-display"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
