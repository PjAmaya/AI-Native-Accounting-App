import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-rule bg-surface px-3 py-2 text-[14px] text-ink " +
  "placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-[12px] text-faint">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-[12px] text-negative">{error}</p> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card px-6 py-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}
