import Decimal from "decimal.js";
import { prisma } from "../db";
import { createDraftEntryTx, postDraftTx } from "../ledger/post";
import type { TxClient } from "../ledger/txClient";
import type { DraftLine } from "../ledger/balance";
import { computeInvoiceTotals } from "./tax";
import { assertNotOverApplied } from "./applications";
import { syncBillStatusTx } from "./documentStatus";

const AP_CODE = "2010";
const HST_RECOVERABLE_CODE = "1250";

export type SupplierCreditDraftLine = {
  description: string;
  amount: string;
  expenseAccountCode: string;
  taxRateCode?: string;
  projectCode?: string;
};

export type SupplierCreditDraft = {
  contactId: string;
  supplierCreditNumber: string;
  originalBillId?: string;
  creditDate: Date;
  reason: string;
  notes?: string;
  taxTotal?: string;
  forceCreditNumber?: number;
  lines: SupplierCreditDraftLine[];
};

export async function createSupplierCreditTx(tx: TxClient, draft: SupplierCreditDraft) {
  if (draft.lines.length === 0) throw new Error("A supplier credit must have at least one line.");
  if (!draft.reason.trim()) throw new Error("A reason is required.");
  if (!draft.supplierCreditNumber.trim()) {
    throw new Error("Their credit note number is required.");
  }

  const profile = await tx.orgProfile.findUnique({ where: { id: "default" } });
  if (!profile) throw new Error("Org profile has not been seeded.");
  const isRegistered =
    profile.hstRegisteredFrom !== null && draft.creditDate >= profile.hstRegisteredFrom;

  const contact = await tx.contact.findUnique({ where: { id: draft.contactId } });
  if (!contact) throw new Error("Contact does not exist.");
  if (!contact.isVendor) throw new Error(`${contact.name} is not marked as a vendor.`);

  const duplicate = await tx.supplierCredit.findFirst({
    where: {
      contactId: contact.id,
      supplierCreditNumber: draft.supplierCreditNumber,
      ...(draft.forceCreditNumber ? { NOT: { creditNumber: draft.forceCreditNumber } } : {}),
    },
  });
  if (duplicate) {
    throw new Error(
      `${contact.name} credit ${draft.supplierCreditNumber} is already recorded as #${duplicate.creditNumber}.`,
    );
  }

  let original = null;
  if (draft.originalBillId) {
    original = await tx.bill.findUnique({ where: { id: draft.originalBillId } });
    if (!original) throw new Error("The original bill does not exist.");
    if (original.contactId !== contact.id) {
      throw new Error("The original bill belongs to a different vendor.");
    }
    if (original.status === "DRAFT") {
      throw new Error("That bill is still a draft — edit it instead of crediting it.");
    }
    if (original.status === "VOID") throw new Error("That bill is void.");
  }

  const projectCodes = [
    ...new Set(draft.lines.map((l) => l.projectCode).filter((c): c is string => Boolean(c))),
  ];
  const projects = await tx.project.findMany({ where: { code: { in: projectCodes } } });
  const projectByCode = new Map(projects.map((p) => [p.code, p]));
  for (const code of projectCodes) {
    if (!projectByCode.has(code)) throw new Error(`Project ${code} does not exist.`);
  }

  const accountCodes = [...new Set(draft.lines.map((l) => l.expenseAccountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: accountCodes } } });
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  for (const code of accountCodes) {
    const account = accountByCode.get(code);
    if (!account) throw new Error(`Account ${code} does not exist.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive.`);
    if (!account.isPostable) throw new Error(`Account ${code} is a heading.`);
    if (account.type !== "EXPENSE" && account.type !== "ASSET") {
      throw new Error(`Account ${code} is ${account.type} and cannot be credited back.`);
    }
  }

  const taxCodes = [
    ...new Set(draft.lines.map((l) => l.taxRateCode).filter((c): c is string => Boolean(c))),
  ];
  const taxRates = await tx.taxRate.findMany({ where: { code: { in: taxCodes } } });
  const taxByCode = new Map(taxRates.map((t) => [t.code, t]));
  for (const code of taxCodes) {
    if (!taxByCode.has(code)) throw new Error(`Tax rate ${code} does not exist.`);
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
    if (!difference.isZero() && lineTax.length > 0) {
      let largest = 0;
      for (let i = 1; i < lineTax.length; i++) {
        if (lineTax[i].greaterThan(lineTax[largest])) largest = i;
      }
      lineTax[largest] = lineTax[largest].plus(difference);
    }
    taxTotal = stated;
  }

  const subtotal = computed.subtotal;
  const total = subtotal.plus(taxTotal);
  if (total.lessThanOrEqualTo(0)) {
    throw new Error("A supplier credit must total more than zero. Enter positive amounts.");
  }

  const last = await tx.supplierCredit.findFirst({
    orderBy: { creditNumber: "desc" },
    select: { creditNumber: true },
  });
  const creditNumber = draft.forceCreditNumber ?? (last?.creditNumber ?? 0) + 1;

  const credit = await tx.supplierCredit.create({
    data: {
      creditNumber,
      supplierCreditNumber: draft.supplierCreditNumber,
      status: "DRAFT",
      contactId: contact.id,
      originalBillId: original?.id ?? null,
      creditDate: draft.creditDate,
      reason: draft.reason.trim(),
      notes: draft.notes ?? null,
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      lines: {
        create: draft.lines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description,
          amount: line.amount,
          expenseAccountId: accountByCode.get(line.expenseAccountCode)!.id,
          projectId: line.projectCode ? projectByCode.get(line.projectCode)!.id : null,
          taxRateId: line.taxRateCode ? taxByCode.get(line.taxRateCode)!.id : null,
          taxAmount: lineTax[index].toFixed(2),
        })),
      },
    },
    include: { lines: true },
  });

  const costGroups = new Map<string, { code: string; projectId: string | null; amount: Decimal }>();
  draft.lines.forEach((line, index) => {
    const projectId = line.projectCode ? projectByCode.get(line.projectCode)!.id : null;
    const key = `${line.expenseAccountCode}|${projectId ?? ""}`;
    const value = isRegistered
      ? new Decimal(line.amount)
      : new Decimal(line.amount).plus(lineTax[index]);
    const existing = costGroups.get(key);
    if (existing) existing.amount = existing.amount.plus(value);
    else costGroups.set(key, { code: line.expenseAccountCode, projectId, amount: value });
  });

  const label = `Supplier credit #${creditNumber} - ${contact.name} ${draft.supplierCreditNumber}`;
  const journalLines: DraftLine[] = [
    {
      accountCode: AP_CODE,
      debit: total.toFixed(2),
      credit: "0",
      description: label,
      contactId: contact.id,
    },
  ];

  for (const group of costGroups.values()) {
    if (group.amount.isZero()) continue;
    journalLines.push({
      accountCode: group.code,
      debit: "0",
      credit: group.amount.toFixed(2),
      description: label,
      contactId: contact.id,
      projectId: group.projectId ?? undefined,
    });
  }

  if (isRegistered && taxTotal.greaterThan(0)) {
    journalLines.push({
      accountCode: HST_RECOVERABLE_CODE,
      debit: "0",
      credit: taxTotal.toFixed(2),
      description: `${label} - ITC reversed`,
      contactId: contact.id,
    });
  }

  const entry = await createDraftEntryTx(tx, {
    entryDate: draft.creditDate,
    description: label,
    lines: journalLines,
  });

  const linked = await tx.supplierCredit.update({
    where: { id: credit.id },
    data: { journalEntryId: entry.id },
    include: { lines: true, contact: true, originalBill: true },
  });

  return { credit: linked, entry, isRegistered };
}

export async function createSupplierCredit(draft: SupplierCreditDraft) {
  return prisma.$transaction((tx) => createSupplierCreditTx(tx, draft));
}
