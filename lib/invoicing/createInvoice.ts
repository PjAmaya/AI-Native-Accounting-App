import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, type TxClient } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";
import { computeInvoiceTotals } from "./tax";

const AR_ACCOUNT_CODE = "1200";

export type InvoiceDraftLine = {
  description: string;
  amount: string;
  quantity?: string;
  unitRate?: string;
  revenueAccountCode: string;
  taxRateCode?: string;
  projectCode?: string;
};

export type InvoiceDraft = {
  contactId: string;
  projectCode?: string;
  invoiceDate: Date;
  dueDate?: Date;
  servicePeriodStart?: Date;
  servicePeriodEnd?: Date;
  clientReference?: string;
  notes?: string;
  currency?: string;
  lines: InvoiceDraftLine[];
};

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function creditLine(amount: Decimal) {
  return amount.isNegative()
    ? { debit: amount.negated().toFixed(2), credit: "0" }
    : { debit: "0", credit: amount.toFixed(2) };
}

function debitLine(amount: Decimal) {
  return amount.isNegative()
    ? { debit: "0", credit: amount.negated().toFixed(2) }
    : { debit: amount.toFixed(2), credit: "0" };
}

export async function createInvoiceTx(tx: TxClient, draft: InvoiceDraft) {
  if (draft.lines.length === 0) {
    throw new Error("An invoice must have at least one line.");
  }

  const contact = await tx.contact.findUnique({ where: { id: draft.contactId } });
  if (!contact) throw new Error("Contact does not exist.");
  if (!contact.isActive) throw new Error(`Contact ${contact.name} is inactive.`);
  if (!contact.isCustomer) throw new Error(`Contact ${contact.name} is not marked as a customer.`);

  const projectCodes = [
    ...new Set(
      [draft.projectCode, ...draft.lines.map((l) => l.projectCode)].filter(
        (c): c is string => Boolean(c),
      ),
    ),
  ];
  const projects = await tx.project.findMany({ where: { code: { in: projectCodes } } });
  const projectByCode = new Map(projects.map((p) => [p.code, p]));
  for (const code of projectCodes) {
    if (!projectByCode.has(code)) throw new Error(`Project ${code} does not exist.`);
  }

  const revenueCodes = [...new Set(draft.lines.map((l) => l.revenueAccountCode))];
  const revenueAccounts = await tx.account.findMany({ where: { code: { in: revenueCodes } } });
  const revenueByCode = new Map(revenueAccounts.map((a) => [a.code, a]));
  for (const code of revenueCodes) {
    const account = revenueByCode.get(code);
    if (!account) throw new Error(`Account ${code} does not exist.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive.`);
    if (!account.isPostable) throw new Error(`Account ${code} is a heading and cannot be invoiced to.`);
    if (account.type !== "REVENUE") {
      throw new Error(`Account ${code} is ${account.type}, not REVENUE, and cannot be an invoice line.`);
    }
  }

  const taxCodes = [
    ...new Set(draft.lines.map((l) => l.taxRateCode).filter((c): c is string => Boolean(c))),
  ];
  const taxRates = await tx.taxRate.findMany({
    where: { code: { in: taxCodes } },
    include: { collectedAccount: true },
  });
  const taxByCode = new Map(taxRates.map((t) => [t.code, t]));
  for (const code of taxCodes) {
    const rate = taxByCode.get(code);
    if (!rate) throw new Error(`Tax rate ${code} does not exist.`);
    if (!rate.isActive) throw new Error(`Tax rate ${code} is inactive.`);
  }

  const totals = computeInvoiceTotals(
    draft.lines.map((line) => ({
      amount: line.amount,
      ratePercent: line.taxRateCode
        ? taxByCode.get(line.taxRateCode)!.ratePercent.toString()
        : "0",
    })),
  );

  const invoiceDate = draft.invoiceDate;
  const dueDate = draft.dueDate ?? addDays(invoiceDate, contact.paymentTermsDays);
  if (dueDate < invoiceDate) throw new Error("Due date cannot be before the invoice date.");

  const year = invoiceDate.getUTCFullYear();
  const prefix = `INV-${year}-`;
  const lastInvoice = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const sequence = lastInvoice
    ? Number.parseInt(lastInvoice.invoiceNumber.slice(prefix.length), 10) + 1
    : 1;
  const invoiceNumber = prefix + String(sequence).padStart(4, "0");

  const invoiceProjectId = draft.projectCode
    ? projectByCode.get(draft.projectCode)!.id
    : null;

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      status: "DRAFT",
      contactId: contact.id,
      projectId: invoiceProjectId,
      invoiceDate,
      dueDate,
      servicePeriodStart: draft.servicePeriodStart ?? null,
      servicePeriodEnd: draft.servicePeriodEnd ?? null,
      clientReference: draft.clientReference ?? null,
      notes: draft.notes ?? null,
      currency: draft.currency ?? "CAD",
      subtotal: totals.subtotal.toFixed(2),
      taxTotal: totals.taxTotal.toFixed(2),
      total: totals.total.toFixed(2),
      lines: {
        create: draft.lines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          quantity: line.quantity ?? null,
          unitRate: line.unitRate ?? null,
          amount: line.amount,
          revenueAccountId: revenueByCode.get(line.revenueAccountCode)!.id,
          taxRateId: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.id : null,
          taxAmount: totals.lineTax[index].toFixed(2),
        })),
      },
    },
    include: { lines: true },
  });

  const revenueGroups = new Map<string, { code: string; projectId: string | null; amount: Decimal }>();
  draft.lines.forEach((line) => {
    const projectId = line.projectCode
      ? projectByCode.get(line.projectCode)!.id
      : invoiceProjectId;
    const key = `${line.revenueAccountCode}|${projectId ?? ""}`;
    const existing = revenueGroups.get(key);
    if (existing) existing.amount = existing.amount.plus(line.amount);
    else
      revenueGroups.set(key, {
        code: line.revenueAccountCode,
        projectId,
        amount: new Decimal(line.amount),
      });
  });

  const taxGroups = new Map<string, Decimal>();
  draft.lines.forEach((line, index) => {
    if (!line.taxRateCode) return;
    const code = taxByCode.get(line.taxRateCode)!.collectedAccount.code;
    taxGroups.set(code, (taxGroups.get(code) ?? new Decimal(0)).plus(totals.lineTax[index]));
  });

  const journalLines: DraftLine[] = [
    {
      accountCode: AR_ACCOUNT_CODE,
      ...debitLine(totals.total),
      description: `${invoiceNumber} - ${contact.name}`,
      contactId: contact.id,
      projectId: invoiceProjectId ?? undefined,
    },
  ];

  for (const group of revenueGroups.values()) {
    if (group.amount.isZero()) continue;
    journalLines.push({
      accountCode: group.code,
      ...creditLine(group.amount),
      description: invoiceNumber,
      contactId: contact.id,
      projectId: group.projectId ?? undefined,
    });
  }

  for (const [code, amount] of taxGroups) {
    if (amount.isZero()) continue;
    journalLines.push({
      accountCode: code,
      ...creditLine(amount),
      description: `${invoiceNumber} - tax`,
      contactId: contact.id,
    });
  }

  const entry = await createDraftEntryTx(tx, {
    entryDate: invoiceDate,
    serviceDate: draft.servicePeriodEnd ?? undefined,
    description: `Invoice ${invoiceNumber} - ${contact.name}`,
    lines: journalLines,
  });

  const linked = await tx.invoice.update({
    where: { id: invoice.id },
    data: { journalEntryId: entry.id },
    include: { lines: true },
  });

  return { invoice: linked, entry };
}

export async function createInvoice(draft: InvoiceDraft) {
  return prisma.$transaction((tx) => createInvoiceTx(tx, draft));
}
