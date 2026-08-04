import Decimal from "decimal.js";
import { balanceSheet, type BsSection } from "@/lib/reporting/balanceSheet";
import { money, longDate } from "@/lib/format";
import { ReportHeader, PeriodForm, TiesBadge } from "@/components/report/ReportShell";

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

function SectionRows({ section }: { section: BsSection }) {
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

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const asOf = utc(sp.to, today);
  const fiscalYearStart = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));

  const bs = await balanceSheet(asOf, fiscalYearStart);

  return (
    <div>
      <ReportHeader
        eyebrow="Financial statement"
        title="Balance Sheet"
        subtitle={`As at ${longDate(asOf)}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PeriodForm from="" to={asOf.toISOString().slice(0, 10)} showFrom={false} />
          <TiesBadge ok={bs.balanced} />
        </div>
      </ReportHeader>

      {!bs.balanced ? (
        <div className="card mt-6 border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px]">
            Assets exceed liabilities and equity by{" "}
            <span className="figure !text-[13px] font-semibold">{money(bs.difference)}</span>. A
            journal entry is missing or unbalanced.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <table className="w-full">
            <tbody>
              <SectionRows section={bs.currentAssets} />
              <SectionRows section={bs.fixedAssets} />
              <Row label="Total assets" value={bs.totalAssets} bold rule />
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <tbody>
              <SectionRows section={bs.currentLiabilities} />
              <SectionRows section={bs.longTermLiabilities} />
              <Row label="Total liabilities" value={bs.totalLiabilities} rule />

              <tr>
                <td className="px-5 pb-1 pt-4" colSpan={2}>
                  <span className="eyebrow">Equity</span>
                </td>
              </tr>
              {bs.ownersEquity.rows.map((row) => (
                <Row key={row.code} code={row.code} label={row.name} value={row.balance} indent={1} />
              ))}
              <Row label="Current period earnings" value={bs.currentPeriodEarnings} indent={1} />
              <Row label="Total equity" value={bs.totalEquity} indent={1} rule />
              <Row label="Liabilities and equity" value={bs.totalLiabilitiesAndEquity} bold rule />
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Working capital</p>
          <p className="kpi mt-1">{money(bs.workingCapital)}</p>
          <p className="mt-1 text-[12px] text-faint">Current assets less current liabilities</p>
        </div>
        <div className="card px-5 py-4.5">
          <p className="eyebrow">Current ratio</p>
          <p className="kpi mt-1">
            {bs.currentRatio === null ? "n/a" : bs.currentRatio.toFixed(2)}
          </p>
          <p className="mt-1 text-[12px] text-faint">Above 1.0 means short-term obligations are covered</p>
        </div>
      </div>
    </div>
  );
}
