import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx } from "../ledger/post";
import type { TxClient } from "../ledger/txClient";
import type { DraftLine } from "../ledger/balance";
import { computeInvoiceTotals } from "./tax";

const DEFAULT_AR_CODE = "1210";

export type CreditNoteDraftLine = {
  description: string;
  amount: string;
  revenueAccountCode: string;
  taxRateCode?: string;
  projectCode?: string;
};

export type CreditNoteDraft = {
  contactId: string;
  originalInvoiceId?: string;
  creditDate: Date;
  reason: string;
  notes?: string;
  currency?: string;
  forceCreditNumber?: string;
  lines: CreditNoteDraftLine[];
};

export async function createCreditNoteTx(tx: TxClient, draft: CreditNoteDraft) {
  if (draft.lines.length === 0) throw new Error("A credit note must have at least one line.");
  if (!draft.reason.trim()) throw new Error("A reason is required.");

  const contact = await tx.contact.findUnique({ where: { id: draft.contactId } });
  if (!contact) throw new Error("Contact does not exist.");
  if (!contact.isCustomer) throw new Error(`${contact.name} is not marked as a customer.`);

  let original = null;
  if (draft.originalInvoiceId) {
    original = await tx.invoice.findUnique({ where: { id: draft.originalInvoiceId } });
    if (!original) throw new Error("The original invoice does not exist.");
    if (original.contactId !== contact.id) {
      throw new Error("The original invoice belongs to a different client.");
    }
    if (original.status === "DRAFT") {
      throw new Error("That invoice is still a draft — edit it instead of crediting it.");
    }
    if (original.status === "VOID") {
      throw new Error("That invoice is void, so there is nothing to credit.");
    }
  }

  const receivableId = original?.receivableAccountId ?? contact.receivableAccountId ?? null;
  const receivable = receivableId
    ? await tx.account.findUnique({ where: { id: receivableId } })
    : await tx.account.findUnique({ where: { code: DEFAULT_AR_CODE } });

  if (!receivable) throw new Error("No receivable account is configured.");
  if (!receivable.isPostable) {
    throw new Error(`Receivable account ${receivable.code} is a heading.`);
  }

  const projectCodes = [
    ...new Set(draft.lines.map((l) => l.projectCode).filter((c): c is string => Boolean(c))),
  ];
  const projects = await tx.project.findMany({ where: { code: { in: projectCodes } } });
  const projectByCode = new Map(projects.map((p) => [p.code, p]));
  for (const code of projectCodes) {
    if (!projectByCode.has(code)) throw new Error(`Project ${code} does not exist.`);
  }

  const accountCodes = [...new Set(draft.lines.map((l) => l.revenueAccountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: accountCodes } } });
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of accountCodes) {
    const account = accountByCode.get(code);
    if (!account) throw new Error(`Account ${code} does not exist.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive.`);
    if (!account.isPostable) throw new Error(`Account ${code} is a heading.`);
    if (account.type !== "REVENUE" && account.type !== "EXPENSE") {
      throw new Error(`Account ${code} is ${account.type} and cannot be credited back.`);
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
    if (!taxByCode.has(code)) throw new Error(`Tax rate ${code} does not exist.`);
  }

  const totals = computeInvoiceTotals(
    draft.lines.map((line) => ({
      amount: line.amount,
      ratePercent: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.ratePercent.toString() : "0",
    })),
  );

  if (totals.total.lessThanOrEqualTo(0)) {
    throw new Error("A credit note must total more than zero. Enter positive amounts.");
  }

  const year = draft.creditDate.getUTCFullYear();
  const prefix = `CN-${year}-`;
  const last = await tx.creditNote.findFirst({
    where: { creditNumber: { startsWith: prefix } },
    orderBy: { creditNumber: "desc" },
    select: { creditNumber: true },
  });
  const sequence = last ? Number.parseInt(last.creditNumber.slice(prefix.length), 10) + 1 : 1;
  const creditNumber = draft.forceCreditNumber ?? prefix + String(sequence).padStart(4, "0");

  const creditNote = await tx.creditNote.create({
    data: {
      creditNumber,
      status: "DRAFT",
      contactId: contact.id,
      originalInvoiceId: original?.id ?? null,
      creditDate: draft.creditDate,
      reason: draft.reason.trim(),
      notes: draft.notes ?? null,
      currency: draft.currency ?? "CAD",
      receivableAccountId: receivable.id,
      subtotal: totals.subtotal.toFixed(2),
      taxTotal: totals.taxTotal.toFixed(2),
      total: totals.total.toFixed(2),
      lines: {
        create: draft.lines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          amount: line.amount,
          revenueAccountId: accountByCode.get(line.revenueAccountCode)!.id,
          projectId: line.projectCode ? projectByCode.get(line.projectCode)!.id : null,
          taxRateId: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.id : null,
          taxAmount: totals.lineTax[index].toFixed(2),
        })),
      },
    },
    include: { lines: true },
  });

  const revenueGroups = new Map<string, { code: string; projectId: string | null; amount: Decimal }>();
  draft.lines.forEach((line, index) => {
    const projectId = line.projectCode ? projectByCode.get(line.projectCode)!.id : null;
    const key = `${line.revenueAccountCode}|${projectId ?? ""}`;
    const existing = revenueGroups.get(key);
    const amount = new Decimal(line.amount);
    if (existing) existing.amount = existing.amount.plus(amount);
    else revenueGroups.set(key, { code: line.revenueAccountCode, projectId, amount });
  });

  const taxGroups = new Map<string, Decimal>();
  draft.lines.forEach((line, index) => {
    if (!line.taxRateCode) return;
    const code = taxByCode.get(line.taxRateCode)!.collectedAccount.code;
    taxGroups.set(code, (taxGroups.get(code) ?? new Decimal(0)).plus(totals.lineTax[index]));
  });

  const label = `${creditNumber} - ${contact.name}${original ? ` (credits ${original.invoiceNumber})` : ""}`;
  const journalLines: DraftLine[] = [];

  for (const group of revenueGroups.values()) {
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

  for (const [code, amount] of taxGroups) {
    if (amount.isZero()) continue;
    journalLines.push({
      accountCode: code,
      debit: amount.toFixed(2),
      credit: "0",
      description: `${label} - tax`,
      contactId: contact.id,
    });
  }

  journalLines.push({
    accountCode: receivable.code,
    debit: "0",
    credit: totals.total.toFixed(2),
    description: label,
    contactId: contact.id,
  });

  const entry = await createDraftEntryTx(tx, {
    entryDate: draft.creditDate,
    description: label,
    lines: journalLines,
  });

  const linked = await tx.creditNote.update({
    where: { id: creditNote.id },
    data: { journalEntryId: entry.id },
    include: { lines: true, contact: true, originalInvoice: true },
  });

  return { creditNote: linked, entry };
}

export async function createCreditNote(draft: CreditNoteDraft) {
  return prisma.$transaction((tx) => createCreditNoteTx(tx, draft));
}
