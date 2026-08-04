import { directCashFlow } from "@/lib/reporting/cashFlow";
import { indirectCashFlow } from "@/lib/reporting/indirectCashFlow";
import type { Granularity } from "@/lib/reporting/periods";
import { money, longDate } from "@/lib/format";
import { ReportHeader, PeriodForm, TiesBadge } from "@/components/report/ReportShell";

export const dynamic = "force-dynamic";

const GRANULARITIES: Granularity[] = ["WEEK", "MONTH", "QUARTER", "YEAR"];

function utc(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; by?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const from = utc(sp.from, new Date(Date.UTC(today.getUTCFullYear(), 0, 1)));
  const to = utc(sp.to, today);
  const by = (GRANULARITIES.includes(sp.by as Granularity) ? sp.by : "MONTH") as Granularity;

  const [direct, indirect] = await Promise.all([
    directCashFlow(from, to, by),
    indirectCashFlow(from, to),
  ]);

  const agree = direct.netChange.equals(indirect.netChangeInCash);
  const activePeriods = direct.periods.filter(
    (p) => !p.netChange.isZero() || !p.openingCash.isZero(),
  );

  const select =
    "rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  return (
    <div>
      <ReportHeader
        eyebrow="Financial statement"
        title="Cash Flow"
        subtitle={`${longDate(from)} to ${longDate(to)}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PeriodForm
            from={from.toISOString().slice(0, 10)}
            to={to.toISOString().slice(0, 10)}
            extra={
              <div>
                <label htmlFor="by" className="eyebrow">Group by</label>
                <select id="by" name="by" defaultValue={by} className={`${select} mt-1 block`}>
                  {GRANULARITIES.map((g) => (
                    <option key={g} value={g}>
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
          <TiesBadge ok={agree} label={agree ? "Methods agree" : "Methods disagree"} />
        </div>
      </ReportHeader>

      <div className="card mt-6 px-5 py-4.5">
        <p className="eyebrow">Profit to cash</p>
        <p className="mt-1.5 text-[15px] leading-relaxed">
          Net income of <span className="font-medium">{money(indirect.netIncome)}</span> became{" "}
          <span className="font-medium">{money(indirect.netChangeInCash)}</span> of cash.
        </p>
        <table className="mt-4 w-full">
          <tbody>
            <tr>
              <td className="py-1.5 text-[13px] text-muted">Net income</td>
              <td className="figure">{money(indirect.netIncome)}</td>
            </tr>
            {[...indirect.nonCashAdjustments, ...indirect.workingCapitalChanges].map((a) => (
              <tr key={a.code}>
                <td className="py-1.5 text-[13px] text-muted">
                  <span className="font-mono text-[12px] text-faint">{a.code}</span> {a.name}
                </td>
                <td className={`figure ${a.cashEffect.isNegative() ? "text-negative" : ""}`}>
                  {money(a.cashEffect)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-rule">
              <td className="py-1.5 text-[13px] font-semibold">Cash from operations</td>
              <td className="figure !text-[14px] font-semibold">{money(indirect.operatingCash)}</td>
            </tr>
            {indirect.investing.length > 0 ? (
              <tr>
                <td className="py-1.5 text-[13px] text-muted">Investing</td>
                <td className="figure">{money(indirect.investingCash)}</td>
              </tr>
            ) : null}
            {indirect.financing.length > 0 ? (
              <tr>
                <td className="py-1.5 text-[13px] text-muted">Financing</td>
                <td className="figure">{money(indirect.financingCash)}</td>
              </tr>
            ) : null}
            <tr className="border-t border-rule">
              <td className="py-1.5 text-[13px] font-semibold">Net change in cash</td>
              <td className="figure !text-[14px] font-semibold">{money(indirect.netChangeInCash)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-rule px-5 py-3">
          <p className="eyebrow">Money in and out</p>
        </div>
        {activePeriods.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            No cash movement in this period.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Period</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Opening</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Operating</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Investing</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Financing</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Change</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Closing</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {activePeriods.map((p) => (
                <tr key={p.label} className="hover:bg-wash/20">
                  <td className="px-5 py-2.5 font-mono text-[12px]">{p.label}</td>
                  <td className="figure px-3 py-2.5">{money(p.openingCash)}</td>
                  <td className="figure px-3 py-2.5">{money(p.operating)}</td>
                  <td className="figure px-3 py-2.5">{money(p.investing)}</td>
                  <td className="figure px-3 py-2.5">{money(p.financing)}</td>
                  <td
                    className={`figure px-3 py-2.5 font-medium ${p.netChange.isNegative() ? "text-negative" : p.netChange.greaterThan(0) ? "text-positive" : ""}`}
                  >
                    {money(p.netChange)}
                  </td>
                  <td className="figure px-5 py-2.5 font-medium">{money(p.closingCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
