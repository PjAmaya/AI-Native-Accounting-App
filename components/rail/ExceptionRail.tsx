import Link from "next/link";
import { AlertTriangle, CircleAlert, Info, Check } from "lucide-react";
import { currentExceptions, type Severity } from "@/lib/reporting/exceptions";
import { money } from "@/lib/format";

const STYLES: Record<Severity, { icon: typeof Info; dot: string; label: string }> = {
  URGENT: { icon: CircleAlert, dot: "bg-negative", label: "Urgent" },
  ATTENTION: { icon: AlertTriangle, dot: "bg-warn", label: "Attention" },
  INFO: { icon: Info, dot: "bg-faint", label: "For information" },
};

export async function ExceptionRail() {
  const exceptions = await currentExceptions(new Date());

  return (
    <aside className="hidden w-80 shrink-0 border-l border-rule bg-surface xl:flex xl:flex-col">
      <div className="border-b border-rule px-5 py-4">
        <p className="eyebrow">Needs attention</p>
        <p className="mt-1 text-[13px] text-muted">
          {exceptions.length === 0
            ? "Nothing outstanding"
            : `${exceptions.length} item${exceptions.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {exceptions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <Check size={20} strokeWidth={1.5} className="text-positive" aria-hidden />
            <p className="text-[13px] text-muted">Everything ties.</p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {exceptions.map((item) => {
              const style = STYLES[item.severity];
              const Icon = style.icon;
              const body = (
                <div className="flex gap-3 px-5 py-3.5">
                  <Icon
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden
                    className={
                      item.severity === "URGENT"
                        ? "mt-0.5 shrink-0 text-negative"
                        : item.severity === "ATTENTION"
                          ? "mt-0.5 shrink-0 text-warn"
                          : "mt-0.5 shrink-0 text-faint"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.detail}</p>
                    {item.amount ? (
                      <p className="figure mt-1.5 !text-left !text-[12px] text-ink">
                        {money(item.amount)}
                      </p>
                    ) : null}
                  </div>
                  <span className="sr-only">{style.label}</span>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link href={item.href} className="block hover:bg-wash/50">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-rule px-5 py-4">
        <div className="rounded-md border border-dashed border-rule px-3 py-2.5 text-[11px] text-faint">
          Ask a question — coming after the invoicing screens.
        </div>
      </div>
    </aside>
  );
}
