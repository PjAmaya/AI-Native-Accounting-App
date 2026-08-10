const STYLES: Record<string, string> = {
  DRAFT: "bg-wash text-muted",
  ISSUED: "bg-tint-blue text-icon-blue",
  APPROVED: "bg-tint-blue text-icon-blue",
  PAID: "bg-tint-green text-icon-green",
  VOID: "bg-wash text-faint",
  OVERDUE: "bg-tint-amber text-icon-amber",
  PARTIAL: "bg-tint-violet text-icon-violet",
};

const LABELS: Record<string, string> = {
  PARTIAL: "Part paid",
};

export function StatusPill({ status }: { status: string }) {
  const label = LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status] ?? STYLES.DRAFT}`}
    >
      {label}
    </span>
  );
}
