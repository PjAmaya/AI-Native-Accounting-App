import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, type TxClient } from "../ledger/post";
import type { DraftLine } from "../ledger/balance";
import { computeInvoiceTotals } from "./tax";

const AP_CODE = "2010";
const HST_RECOVERABLE_CODE = "1250";
const TAX_TOLERANCE = new Decimal("0.05");

export type BillDraftLine = {
  description: string;
  amount: string;
  quantity?: string;
  unitRate?: string;
  expenseAccountCode: string;
  taxRateCode?: string;
  projectCode?: string;
};

export type BillDraft = {
  contactId: string;
  supplierInvoiceNumber: string;
  billDate: Date;
  dueDate?: Date;
  servicePeriodStart?: Date;
  servicePeriodEnd?: Date;
  notes?: string;
  currency?: string;
  projectCode?: string;
  taxTotal?: string;
  acceptTaxVariance?: boolean;
  forceBillNumber?: number;
  lines: BillDraftLine[];
};

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function createBillTx(tx: TxClient, draft: BillDraft) {
  if (draft.lines.length === 0) throw new Error("A bill must have at least one line.");
  if (!draft.supplierInvoiceNumber.trim()) {
    throw new Error("A supplier invoice number is required.");
  }

  const warnings: string[] = [];

  const profile = await tx.orgProfile.findUnique({ where: { id: "default" } });
  if (!profile) throw new Error("Org profile has not been seeded.");

  const isRegistered =
    profile.hstRegisteredFrom !== null && draft.billDate >= profile.hstRegisteredFrom;

  const contact = await tx.contact.findUnique({ where: { id: draft.contactId } });
  if (!contact) throw new Error("Contact does not exist.");
  if (!contact.isActive) throw new Error(`Contact ${contact.name} is inactive.`);
  if (!contact.isVendor) throw new Error(`Contact ${contact.name} is not marked as a vendor.`);

  const duplicate = await tx.bill.findFirst({
    where: { contactId: contact.id, supplierInvoiceNumber: draft.supplierInvoiceNumber },
  });
  if (duplicate) {
    throw new Error(
      `${contact.name} invoice ${draft.supplierInvoiceNumber} is already recorded as bill #${duplicate.billNumber}.`,
    );
  }

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

  const expenseCodes = [...new Set(draft.lines.map((l) => l.expenseAccountCode))];
  const expenseAccounts = await tx.account.findMany({ where: { code: { in: expenseCodes } } });
  const expenseByCode = new Map(expenseAccounts.map((a) => [a.code, a]));
  for (const code of expenseCodes) {
    const account = expenseByCode.get(code);
    if (!account) throw new Error(`Account ${code} does not exist.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive.`);
    if (!account.isPostable) throw new Error(`Account ${code} is a heading.`);
    if (account.type !== "EXPENSE" && account.type !== "ASSET") {
      throw new Error(`Account ${code} is ${account.type}; a bill line must be an expense or an asset.`);
    }
  }

  const taxCodes = [
    ...new Set(draft.lines.map((l) => l.taxRateCode).filter((c): c is string => Boolean(c))),
  ];
  const taxRates = await tx.taxRate.findMany({ where: { code: { in: taxCodes } } });
  const taxByCode = new Map(taxRates.map((t) => [t.code, t]));
  for (const code of taxCodes) {
    const rate = taxByCode.get(code);
    if (!rate) throw new Error(`Tax rate ${code} does not exist.`);
    if (!rate.isActive) throw new Error(`Tax rate ${code} is inactive.`);
  }

  if (taxCodes.length > 0 && !contact.isHstRegistered) {
    warnings.push(
      `${contact.name} is not marked as HST registered but this bill carries tax. Confirm their registration number.`,
    );
  }

  const computed = computeInvoiceTotals(
    draft.lines.map((line) => ({
      amount: line.amount,
      ratePercent: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.ratePercent.toString() : "0",
    })),
  );

  const lineTax = [...computed.lineTax];
  let taxTotal = computed.taxTotal;

  if (draft.taxTotal !== undefined) {
    const stated = new Decimal(draft.taxTotal);
    const difference = stated.minus(computed.taxTotal);

    if (difference.abs().greaterThan(TAX_TOLERANCE) && !draft.acceptTaxVariance) {
      throw new Error(
        `Supplier tax of ${stated.toFixed(2)} differs from ${computed.taxTotal.toFixed(2)} calculated from the lines. Check the amounts before recording this bill.`,
      );
    }

    if (!difference.isZero()) {
      let largest = 0;
      for (let i = 1; i < lineTax.length; i++) {
        if (lineTax[i].greaterThan(lineTax[largest])) largest = i;
      }
      lineTax[largest] = lineTax[largest].plus(difference);
      warnings.push(
        `Used the supplier's tax of ${stated.toFixed(2)} rather than the calculated ${computed.taxTotal.toFixed(2)}.`,
      );
    }

    taxTotal = stated;
  }

  const subtotal = computed.subtotal;
  const total = subtotal.plus(taxTotal);

  const threshold = new Decimal(profile.capitalizationThreshold.toString());
  draft.lines.forEach((line, index) => {
    const account = expenseByCode.get(line.expenseAccountCode)!;
    if (account.capitalCandidate && new Decimal(line.amount).greaterThanOrEqualTo(threshold)) {
      warnings.push(
        `Line ${index + 1} (${new Decimal(line.amount).toFixed(2)}) is at or above the ${threshold.toFixed(2)} capitalization threshold but is going to expense account ${account.code}. Consider capitalizing it.`,
      );
    }
  });

  const dueDate = draft.dueDate ?? addDays(draft.billDate, contact.paymentTermsDays);
  if (dueDate < draft.billDate) throw new Error("Due date cannot be before the bill date.");

  const lastBill = await tx.bill.findFirst({
    orderBy: { billNumber: "desc" },
    select: { billNumber: true },
  });
  const billNumber = draft.forceBillNumber ?? (lastBill?.billNumber ?? 0) + 1;

  const billProjectId = draft.projectCode ? projectByCode.get(draft.projectCode)!.id : null;

  const bill = await tx.bill.create({
    data: {
      billNumber,
      supplierInvoiceNumber: draft.supplierInvoiceNumber,
      status: "DRAFT",
      contactId: contact.id,
      projectId: billProjectId,
      billDate: draft.billDate,
      dueDate,
      servicePeriodStart: draft.servicePeriodStart ?? null,
      servicePeriodEnd: draft.servicePeriodEnd ?? null,
      notes: draft.notes ?? null,
      currency: draft.currency ?? "CAD",
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      lines: {
        create: draft.lines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          quantity: line.quantity ?? null,
          unitRate: line.unitRate ?? null,
          amount: line.amount,
          expenseAccountId: expenseByCode.get(line.expenseAccountCode)!.id,
          projectId: line.projectCode
            ? projectByCode.get(line.projectCode)!.id
            : billProjectId,
          taxRateId: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.id : null,
          taxAmount: lineTax[index].toFixed(2),
        })),
      },
    },
    include: { lines: true },
  });

  const costGroups = new Map<string, { code: string; projectId: string | null; amount: Decimal }>();
  draft.lines.forEach((line, index) => {
    const projectId = line.projectCode ? projectByCode.get(line.projectCode)!.id : billProjectId;
    const key = `${line.expenseAccountCode}|${projectId ?? ""}`;
    const cost = isRegistered
      ? new Decimal(line.amount)
      : new Decimal(line.amount).plus(lineTax[index]);
    const existing = costGroups.get(key);
    if (existing) existing.amount = existing.amount.plus(cost);
    else costGroups.set(key, { code: line.expenseAccountCode, projectId, amount: cost });
  });

  const label = `Bill #${billNumber} - ${contact.name} ${draft.supplierInvoiceNumber}`;
  const journalLines: DraftLine[] = [];

  for (const group of costGroups.values()) {
    if (group.amount.isZero()) continue;
    journalLines.push({
      accountCode: group.code,
      debit: group.amount.toFixed(2),
      credit: "0",
      description: label,
      contactId: contact.id,
      projectId: group.projectId ?? undefined,
    });
  }

  if (isRegistered && taxTotal.greaterThan(0)) {
    journalLines.push({
      accountCode: HST_RECOVERABLE_CODE,
      debit: taxTotal.toFixed(2),
      credit: "0",
      description: `${label} - ITC`,
      contactId: contact.id,
    });
  }

  journalLines.push({
    accountCode: AP_CODE,
    debit: "0",
    credit: total.toFixed(2),
    description: label,
    contactId: contact.id,
  });

  const entry = await createDraftEntryTx(tx, {
    entryDate: draft.billDate,
    serviceDate: draft.servicePeriodEnd ?? undefined,
    description: label,
    lines: journalLines,
  });

  const linked = await tx.bill.update({
    where: { id: bill.id },
    data: { journalEntryId: entry.id, warnings },
    include: { lines: true, contact: true },
  });

  return { bill: linked, entry, warnings, isRegistered };
}

export async function createBill(draft: BillDraft) {
  return prisma.$transaction((tx) => createBillTx(tx, draft));
}
