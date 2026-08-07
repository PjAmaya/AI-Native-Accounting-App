import Decimal from "decimal.js";
import { prisma } from "../db";
import { profitAndLoss } from "../reporting/profitAndLoss";
import { balanceSheet } from "../reporting/balanceSheet";
import { directCashFlow } from "../reporting/cashFlow";
import { indirectCashFlow } from "../reporting/indirectCashFlow";
import { arAging, apAging } from "../reporting/aging";
import { financialRatios } from "../reporting/financialRatios";
import type { Granularity } from "../reporting/periods";

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JsonSchema;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function utcDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function yearStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function num(value: unknown) {
  return new Decimal(String(value)).toFixed(2);
}

const DATE_PROP = { type: "string", description: "Date as YYYY-MM-DD" };

export const TOOLS: ToolDefinition[] = [
  {
    name: "get_profit_and_loss",
    description:
      "Revenue, cost of services, operating expenses, net income, EBITDA and margin ratios for a period. " +
      "Defaults to the current fiscal year to date.",
    parameters: {
      type: "object",
      properties: { from: DATE_PROP, to: DATE_PROP },
    },
    handler: async (args) => {
      const to = utcDate(str(args, "to"), today());
      const from = utcDate(str(args, "from"), yearStart(to));
      const pnl = await profitAndLoss(from, to);
      return {
        period: { from: iso(from), to: iso(to) },
        revenue: pnl.revenue.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        totalRevenue: num(pnl.revenue.total),
        costOfServices: pnl.costOfServices.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        grossProfit: num(pnl.grossProfit),
        operatingExpenses: pnl.operatingExpenses.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        operatingIncome: num(pnl.operatingIncome),
        netIncome: num(pnl.netIncome),
        ebitda: num(pnl.ebitda),
        ratiosPercent: {
          grossMargin: pnl.ratios.grossMargin?.toString() ?? null,
          operatingMargin: pnl.ratios.operatingMargin?.toString() ?? null,
          ebitdaMargin: pnl.ratios.ebitdaMargin?.toString() ?? null,
          netMargin: pnl.ratios.netMargin?.toString() ?? null,
        },
      };
    },
  },
  {
    name: "get_balance_sheet",
    description: "Assets, liabilities and equity as at a date, plus working capital and current ratio.",
    parameters: { type: "object", properties: { asOf: DATE_PROP } },
    handler: async (args) => {
      const asOf = utcDate(str(args, "asOf"), today());
      const bs = await balanceSheet(asOf, yearStart(asOf));
      return {
        asOf: iso(asOf),
        currentAssets: bs.currentAssets.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        fixedAssets: bs.fixedAssets.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        totalAssets: num(bs.totalAssets),
        currentLiabilities: bs.currentLiabilities.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        totalLiabilities: num(bs.totalLiabilities),
        equity: bs.ownersEquity.rows.map((r) => ({ code: r.code, name: r.name, amount: num(r.balance) })),
        currentPeriodEarnings: num(bs.currentPeriodEarnings),
        totalEquity: num(bs.totalEquity),
        balanced: bs.balanced,
        workingCapital: num(bs.workingCapital),
        currentRatio: bs.currentRatio?.toString() ?? null,
      };
    },
  },
  {
    name: "get_cash_flow",
    description:
      "Cash movement for a period. Returns the indirect reconciliation from net income to cash, " +
      "and per-period money in and out. Use this to explain why profit and cash differ.",
    parameters: {
      type: "object",
      properties: {
        from: DATE_PROP,
        to: DATE_PROP,
        groupBy: { type: "string", enum: ["WEEK", "MONTH", "QUARTER", "YEAR"] },
      },
    },
    handler: async (args) => {
      const to = utcDate(str(args, "to"), today());
      const from = utcDate(str(args, "from"), yearStart(to));
      const groupBy = (str(args, "groupBy") ?? "MONTH") as Granularity;
      const [direct, indirect] = await Promise.all([
        directCashFlow(from, to, groupBy),
        indirectCashFlow(from, to),
      ]);
      return {
        period: { from: iso(from), to: iso(to) },
        netIncome: num(indirect.netIncome),
        adjustments: [...indirect.nonCashAdjustments, ...indirect.workingCapitalChanges].map((a) => ({
          code: a.code,
          name: a.name,
          cashEffect: num(a.cashEffect),
        })),
        operatingCash: num(indirect.operatingCash),
        netChangeInCash: num(indirect.netChangeInCash),
        openingCash: num(indirect.openingCash),
        closingCash: num(indirect.closingCash),
        methodsAgree: direct.netChange.equals(indirect.netChangeInCash),
        periods: direct.periods
          .filter((p) => !p.netChange.isZero())
          .map((p) => ({
            label: p.label,
            operating: num(p.operating),
            investing: num(p.investing),
            financing: num(p.financing),
            netChange: num(p.netChange),
            closingCash: num(p.closingCash),
          })),
      };
    },
  },
  {
    name: "get_aging",
    description:
      "Open invoices or bills bucketed by how overdue they are, with a check that the subledger " +
      "ties to the general ledger.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["AR", "AP"], description: "AR is money owed to us, AP is money we owe" },
        asOf: DATE_PROP,
      },
      required: ["direction"],
    },
    handler: async (args) => {
      const asOf = utcDate(str(args, "asOf"), today());
      const report = str(args, "direction") === "AP" ? await apAging(asOf) : await arAging(asOf);
      return {
        asOf: iso(asOf),
        direction: report.direction,
        buckets: Object.fromEntries(
          Object.entries(report.byBucket).map(([k, v]) => [k, num(v)]),
        ),
        documents: report.rows.map((r) => ({
          document: r.documentNumber,
          contact: r.contactName,
          dueDate: iso(r.dueDate),
          daysPastDue: r.daysPastDue,
          outstanding: num(r.outstanding),
        })),
        total: num(report.subledgerTotal),
        ledgerBalance: num(report.glBalance),
        ties: report.ties,
        difference: num(report.difference),
      };
    },
  },
  {
    name: "get_financial_ratios",
    description:
      "Return on assets and equity, debt to equity, days sales outstanding, and revenue concentration by client.",
    parameters: { type: "object", properties: { from: DATE_PROP, to: DATE_PROP } },
    handler: async (args) => {
      const to = utcDate(str(args, "to"), today());
      const from = utcDate(str(args, "from"), yearStart(to));
      const r = await financialRatios(from, to);
      return {
        period: { from: iso(from), to: iso(to) },
        returnOnAssetsPercent: r.returnOnAssets?.toString() ?? null,
        returnOnEquityPercent: r.returnOnEquity?.toString() ?? null,
        debtToEquity: r.debtToEquity?.toString() ?? null,
        daysSalesOutstanding: r.daysSalesOutstanding?.toString() ?? null,
        firstPeriod: r.firstPeriod,
        revenueByClient: r.revenueByClient.map((c) => ({
          name: c.name,
          amount: num(c.amount),
          percentOfRevenue: c.percentOfRevenue.toString(),
        })),
      };
    },
  },
  {
    name: "list_invoices",
    description: "Invoices with their status, dates, totals and outstanding balance.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "ISSUED", "PAID", "VOID"] },
        clientName: { type: "string" },
      },
    },
    handler: async (args) => {
      const status = str(args, "status");
      const clientName = str(args, "clientName");
      const invoices = await prisma.invoice.findMany({
        where: {
          ...(status ? { status: status as "DRAFT" | "ISSUED" | "PAID" | "VOID" } : {}),
          ...(clientName ? { contact: { name: { contains: clientName, mode: "insensitive" } } } : {}),
        },
        include: { contact: true, applications: true, project: true },
        orderBy: { invoiceDate: "desc" },
        take: 50,
      });
      return invoices.map((i) => {
        const applied = i.applications.reduce(
          (sum, a) => sum.plus(a.amountApplied.toString()),
          new Decimal(0),
        );
        return {
          invoiceNumber: i.invoiceNumber,
          client: i.contact.name,
          project: i.project?.code ?? null,
          status: i.status,
          invoiceDate: iso(i.invoiceDate),
          dueDate: iso(i.dueDate),
          total: num(i.total),
          outstanding: new Decimal(i.total.toString()).minus(applied).toFixed(2),
        };
      });
    },
  },
  {
    name: "list_bills",
    description: "Supplier bills with their status, vendor, dates and outstanding balance.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT", "APPROVED", "PAID", "VOID"] },
        vendorName: { type: "string" },
      },
    },
    handler: async (args) => {
      const status = str(args, "status");
      const vendorName = str(args, "vendorName");
      const bills = await prisma.bill.findMany({
        where: {
          ...(status ? { status: status as "DRAFT" | "APPROVED" | "PAID" | "VOID" } : {}),
          ...(vendorName ? { contact: { name: { contains: vendorName, mode: "insensitive" } } } : {}),
        },
        include: { contact: true, applications: true },
        orderBy: { billDate: "desc" },
        take: 50,
      });
      return bills.map((b) => {
        const applied = b.applications.reduce(
          (sum, a) => sum.plus(a.amountApplied.toString()),
          new Decimal(0),
        );
        return {
          billNumber: b.billNumber,
          supplierInvoiceNumber: b.supplierInvoiceNumber,
          vendor: b.contact.name,
          status: b.status,
          billDate: iso(b.billDate),
          dueDate: iso(b.dueDate),
          total: num(b.total),
          outstanding: new Decimal(b.total.toString()).minus(applied).toFixed(2),
        };
      });
    },
  },
  {
    name: "get_project_margin",
    description:
      "Revenue, direct cost and margin for each project, from posted journal lines. " +
      "Use this for questions about which engagements are profitable.",
    parameters: { type: "object", properties: { from: DATE_PROP, to: DATE_PROP } },
    handler: async (args) => {
      const to = utcDate(str(args, "to"), today());
      const from = utcDate(str(args, "from"), yearStart(to));

      const lines = await prisma.journalLine.findMany({
        where: {
          projectId: { not: null },
          entry: { status: { in: ["POSTED", "REVERSED"] }, entryDate: { gte: from, lte: to } },
          account: { subType: { in: ["OPERATING_REVENUE", "COST_OF_SERVICES"] } },
        },
        include: { account: true, project: true },
      });

      const byProject = new Map<string, { revenue: Decimal; cost: Decimal; name: string }>();

      for (const line of lines) {
        const code = line.project!.code;
        const entry = byProject.get(code) ?? {
          revenue: new Decimal(0),
          cost: new Decimal(0),
          name: line.project!.name,
        };
        const debit = new Decimal(line.debit.toString());
        const credit = new Decimal(line.credit.toString());
        if (line.account.subType === "OPERATING_REVENUE") {
          entry.revenue = entry.revenue.plus(credit).minus(debit);
        } else {
          entry.cost = entry.cost.plus(debit).minus(credit);
        }
        byProject.set(code, entry);
      }

      return {
        period: { from: iso(from), to: iso(to) },
        projects: [...byProject.entries()].map(([code, v]) => {
          const margin = v.revenue.minus(v.cost);
          return {
            code,
            name: v.name,
            revenue: v.revenue.toFixed(2),
            directCost: v.cost.toFixed(2),
            margin: margin.toFixed(2),
            marginPercent: v.revenue.isZero()
              ? null
              : margin.dividedBy(v.revenue).times(100).toDecimalPlaces(1).toString(),
          };
        }),
      };
    },
  },
];

export const ADVISORY_TOOLS: ToolDefinition[] = [
  {
    name: "list_accounts",
    description:
      "The chart of accounts for this business: code, name, type, sub-type, whether it is postable, " +
      "and whether it is flagged as a capitalization candidate. Call this before recommending where " +
      "to record anything, so the advice names accounts that actually exist.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
          description: "Optional filter",
        },
      },
    },
    handler: async (args) => {
      const type = str(args, "type");
      const accounts = await prisma.account.findMany({
        where: {
          isActive: true,
          ...(type ? { type: type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" } : {}),
        },
        orderBy: { code: "asc" },
      });
      return accounts.map((a) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        subType: a.subType,
        postable: a.isPostable,
        capitalizationCandidate: a.capitalCandidate,
      }));
    },
  },
  {
    name: "get_business_context",
    description:
      "Facts about this business that change the correct accounting treatment: legal structure, " +
      "HST registration status, fiscal year end, and the capitalization threshold. " +
      "Call this before giving any advice about tax or capitalization.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const profile = await prisma.orgProfile.findUnique({ where: { id: "default" } });
      if (!profile) return { error: "No org profile configured." };
      return {
        legalName: profile.legalName,
        structure: "Sole proprietorship — not a separate taxpayer. Business income flows to the owner's personal T1 via form T2125.",
        province: profile.province ?? "ON",
        hstRegistered: profile.hstRegisteredFrom !== null,
        hstRegisteredFrom: profile.hstRegisteredFrom ? iso(profile.hstRegisteredFrom) : null,
        capitalizationThreshold: num(profile.capitalizationThreshold),
        fiscalYearEnd: "December 31",
        basisOfAccounting: "Accrual",
      };
    },
  },
];

export const ALL_TOOLS: ToolDefinition[] = [...TOOLS, ...ADVISORY_TOOLS];

export const TOOLS_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export type CodeIssue = { code: string; statedName: string; actualName: string | null };

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function checkAccountCodes(answer: string): Promise<CodeIssue[]> {
  const pattern = /\b([1-7]\d{3})\b[\s*_]*[-–—:]?[\s*_]*([A-Z][A-Za-z&/().'-]*(?:\s+[A-Za-z&/().'-]+){0,5})/g;

  const references = new Map<string, string>();
  for (const match of answer.matchAll(pattern)) {
    const code = match[1];
    const statedName = match[2].trim().replace(/[.,;:]$/, "");
    if (statedName.length < 3) continue;
    if (!references.has(code)) references.set(code, statedName);
  }

  if (references.size === 0) return [];

  const accounts = await prisma.account.findMany({
    where: { code: { in: [...references.keys()] } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a.name]));

  const issues: CodeIssue[] = [];

  for (const [code, statedName] of references) {
    const actualName = byCode.get(code) ?? null;

    if (!actualName) {
      issues.push({ code, statedName, actualName: null });
      continue;
    }

    const stated = normalizeName(statedName);
    const actual = normalizeName(actualName);
    if (!actual.startsWith(stated) && !stated.startsWith(actual)) {
      issues.push({ code, statedName, actualName });
    }
  }

  return issues;
}
