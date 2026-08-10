import Link from "next/link";

export type FilterOption = { value: string; label: string };

const input =
  "rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function ListFilters({
  basePath,
  statuses,
  contacts,
  projects,
  current,
  contactLabel,
}: {
  basePath: string;
  statuses: FilterOption[];
  contacts: FilterOption[];
  projects?: FilterOption[];
  contactLabel: string;
  current: {
    status?: string;
    contact?: string;
    project?: string;
    from?: string;
    to?: string;
    q?: string;
  };
}) {
  const active = Object.values(current).filter(Boolean).length;

  return (
    <form method="get" action={basePath} className="card mt-6 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="eyebrow">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Number or reference"
            className={`${input} mt-1 block w-44`}
          />
        </div>

        <div>
          <label htmlFor="status" className="eyebrow">Status</label>
          <select id="status" name="status" defaultValue={current.status ?? ""} className={`${input} mt-1 block`}>
            <option value="">Any</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact" className="eyebrow">{contactLabel}</label>
          <select id="contact" name="contact" defaultValue={current.contact ?? ""} className={`${input} mt-1 block max-w-44`}>
            <option value="">Any</option>
            {contacts.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {projects && projects.length > 0 ? (
          <div>
            <label htmlFor="project" className="eyebrow">Project</label>
            <select id="project" name="project" defaultValue={current.project ?? ""} className={`${input} mt-1 block`}>
              <option value="">Any</option>
              {projects.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="from" className="eyebrow">From</label>
          <input id="from" name="from" type="date" defaultValue={current.from ?? ""} className={`${input} mt-1 block`} />
        </div>

        <div>
          <label htmlFor="to" className="eyebrow">To</label>
          <input id="to" name="to" type="date" defaultValue={current.to ?? ""} className={`${input} mt-1 block`} />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
        >
          Filter
        </button>

        {active > 0 ? (
          <Link href={basePath} className="px-2 py-2 text-[13px] text-muted hover:text-ink">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
