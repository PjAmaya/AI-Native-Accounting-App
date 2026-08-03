import Decimal from "decimal.js";
import { prisma } from "../db";
import { arAging, apAging } from "./aging";
import { profitAndLoss } from "./profitAndLoss";

export type Severity = "URGENT" | "ATTENTION" | "INFO";

export type Exception = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  amount: Decimal | null;
  href: string | null;
};

const ORDER: Record<Severity, number> = { URGENT: 0, ATTENTION: 1, INFO: 2 };

function utcStartOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function currentExceptions(asOf: Date): Promise<Exception[]> {
  const out: Exception[] = [];

  const ar = await arAging(asOf);
  const ap = await apAging(asOf);

  const overdue = ar.rows.filter((r) => r.daysPastDue > 0);
  if (overdue.length > 0) {
    const total = overdue.reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0));
    const worst = Math.max(...overdue.map((r) => r.daysPastDue));
    out.push({
      id: "ar-overdue",
      severity: worst > 60 ? "URGENT" : "ATTENTION",
      title: `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} overdue`,
      detail: `Oldest is ${worst} days past due`,
      amount: total,
      href: "/reports/aging",
    });
  }

  if (!ar.ties) {
    out.push({
      id: "ar-tie",
      severity: "URGENT",
      title: "Receivables do not tie",
      detail: "Open invoices differ from the 1200 balance",
      amount: ar.difference,
      href: "/reports/aging",
    });
  }

  if (!ap.ties) {
    out.push({
      id: "ap-tie",
      severity: "URGENT",
      title: "Payables do not tie",
      detail: "Open bills differ from the 2010 balance",
      amount: ap.difference,
      href: "/reports/aging",
    });
  }

  const draftInvoices = await prisma.invoice.findMany({ where: { status: "DRAFT" } });
  if (draftInvoices.length > 0) {
    out.push({
      id: "invoice-drafts",
      severity: "ATTENTION",
      title: `${draftInvoices.length} invoice${draftInvoices.length === 1 ? "" : "s"} not issued`,
      detail: "Drafts are invisible to the books until issued",
      amount: draftInvoices.reduce((sum, i) => sum.plus(i.total.toString()), new Decimal(0)),
      href: "/invoices",
    });
  }

  const draftBills = await prisma.bill.findMany({ where: { status: "DRAFT" } });
  if (draftBills.length > 0) {
    out.push({
      id: "bill-drafts",
      severity: "ATTENTION",
      title: `${draftBills.length} bill${draftBills.length === 1 ? "" : "s"} awaiting approval`,
      detail: "Unapproved bills are not in the books",
      amount: draftBills.reduce((sum, b) => sum.plus(b.total.toString()), new Decimal(0)),
      href: "/reports/aging",
    });
  }

  const dueSoon = ap.rows.filter((r) => r.daysPastDue <= 0 && r.dueDate <= addDays(asOf, 7));
  if (dueSoon.length > 0) {
    out.push({
      id: "ap-due-soon",
      severity: "INFO",
      title: `${dueSoon.length} bill${dueSoon.length === 1 ? "" : "s"} due within 7 days`,
      detail: "Plan the payment run",
      amount: dueSoon.reduce((sum, r) => sum.plus(r.outstanding), new Decimal(0)),
      href: "/reports/aging",
    });
  }

  const pnl = await profitAndLoss(utcStartOfYear(asOf), asOf);
  const receivable = ar.glBalance;
  if (pnl.netIncome.greaterThan(0) && receivable.greaterThan(0)) {
    out.push({
      id: "profit-cash-gap",
      severity: "INFO",
      title: "Profit is ahead of cash",
      detail: "Earned but not yet collected",
      amount: receivable,
      href: "/reports/cash-flow",
    });
  }

  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
