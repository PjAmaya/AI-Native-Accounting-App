import Decimal from "decimal.js";
import { profitAndLoss, type PnlSection } from "@/lib/reporting/profitAndLoss";
import { money, longDate } from "@/lib/format";
import { ReportHeader, PeriodForm } from "@/components/report/ReportShell";

export const dynamic = "force-dynamic";

function utc(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function Row({
  label,
  code,
  value,
  indent = 0,
  bold,
  rule,
}: {
  label: string;
  code?: string;
  value: Decimal;
  indent?: number;
  bold?: boolean;
  rule?: boolean;
}) {
  return (
    <tr className={rule ? "border-t border-rule" : undefined}>
      <td
        className={`py-1.5 text-[13px] ${bold ? "font-semibold" : ""}`}
        style={{ paddingLeft: `${20 + indent * 16}px` }}
      >
        {code ? <span className="font-mono text-[12px] text-faint">{code}</span> : null}
        {code ? " " : null}
        {label}
      </td>
      <td className={`figure pr-5 ${bold ? "!text-[14px] font-semibold" : ""}`}>{money(value)}</td>
    </tr>
  );
}

function SectionRows({ section }: { section: PnlSection }) {
  if (section.rows.length === 0) return null;
  return (
    <>
      <tr>
        <td className="px-5 pb-1 pt-4" colSpan={2}>
          <span className="eyebrow">{section.title}</span>
        </td>
      </tr>
      {section.rows.map((row) => (
        <Row key={row.code} code={row.code} label={row.name} value={row.balance} indent={1} />
      ))}
      <Row label={`Total ${section.title.toLowerCase()}`} value={section.total} indent={1} rule />
    </>
  );
}

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const from = utc(sp.from, new Date(Date.UTC(today.getUTCFullYear(), 0, 1)));
  const to = utc(sp.to, today);

  const pnl = await profitAndLoss(from, to);

  const ratios = [
    { label: "Gross margin", value: pnl.ratios.grossMargin },
    { label: "Operating margin", value: pnl.ratios.operatingMargin },
    { label: "EBITDA margin", value: pnl.ratios.ebitdaMargin },
    { label: "Net margin", value: pnl.ratios.netMargin },
    { label: "Opex ratio", value: pnl.ratios.operatingExpenseRatio },
  ];

  return (
    <div>
      <ReportHeader
        eyebrow="Financial statement"
        title="Profit & Loss"
        subtitle={`${longDate(from)} to ${longDate(to)}`}
      >
        <PeriodForm from={from.toISOString().slice(0, 10)} to={to.toISOString().slice(0, 10)} />
      </ReportHeader>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full">
          <tbody>
            <SectionRows section={pnl.revenue} />
            <SectionRows section={pnl.costOfServices} />
            <Row label="Gross profit" value={pnl.grossProfit} bold rule />
            <SectionRows section={pnl.operatingExpenses} />
            <Row label="Operating income" value={pnl.operatingIncome} bold rule />
            <SectionRows section={pnl.otherIncome} />
            <SectionRows section={pnl.otherExpenses} />
            <Row label="Net income" value={pnl.netIncome} bold rule />
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="card px-5 py-4.5">
          <p className="eyebrow">EBITDA reconciliation</p>
          <table className="mt-3 w-full">
            <tbody>
              <tr>
                <td className="py-1 text-[13px] text-muted">Net income</td>
                <td className="figure">{money(pnl.netIncome)}</td>
              </tr>
              {pnl.addBacks.length === 0 ? (
                <tr>
                  <td className="py-1 text-[12px] text-faint" colSpan={2}>
                    No add-backs in this period.
                  </td>
                </tr>
              ) : (
                pnl.addBacks.map((item) => (
                  <tr key={item.code}>
                    <td className="py-1 text-[13px] text-muted">
                      <span className="font-mono text-[12px] text-faint">{item.code}</span>{" "}
                      {item.name}
                    </td>
                    <td className="figure">{money(item.amount)}</td>
                  </tr>
                ))
              )}
              <tr className="border-t border-rule">
                <td className="py-1.5 text-[13px] font-semibold">EBITDA</td>
                <td className="figure !text-[14px] font-semibold">{money(pnl.ebitda)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card px-5 py-4.5">
          <p className="eyebrow">Ratios</p>
          <table className="mt-3 w-full">
            <tbody>
              {ratios.map((r) => (
                <tr key={r.label}>
                  <td className="py-1 text-[13px] text-muted">{r.label}</td>
                  <td className="figure">
                    {r.value === null ? (
                      <span className="text-faint">n/a</span>
                    ) : (
                      `${r.value.toFixed(1)}%`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
