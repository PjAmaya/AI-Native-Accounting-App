"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordPayment, type PaymentDraft } from "@/lib/invoicing/recordPayment";
import { updateDraftPayment, deleteDraftPayment } from "@/lib/invoicing/updateDraftPayment";
import { applyPayment } from "@/lib/invoicing/applyPayment";
import { sumApplied } from "@/lib/invoicing/applications";
import { prisma } from "@/lib/db";

export type PaymentFormState = {
  ok: boolean;
  message: string;
  errors: Record<string, string>;
} | null;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function utcDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseApplications(formData: FormData, errors: Record<string, string>) {
  const applications: { invoiceNumber: string; amount: string }[] = [];
  const billApplications: { billNumber: number; amount: string }[] = [];
  let totalApplied = new Decimal(0);

  for (const [key, value] of formData.entries()) {
    const isInvoice = key.startsWith("applyInvoice:");
    const isBill = key.startsWith("applyBill:");
    if (!isInvoice && !isBill) continue;
    if (typeof value !== "string" || value.trim() === "") continue;

    const documentLabel = key.slice(key.indexOf(":") + 1);

    let applied: Decimal;
    try {
      applied = new Decimal(value);
    } catch {
      errors.applications = `The amount applied to ${documentLabel} is not a number.`;
      continue;
    }
    if (applied.lessThanOrEqualTo(0)) continue;

    if (isInvoice) {
      applications.push({ invoiceNumber: documentLabel, amount: applied.toFixed(2) });
      totalApplied = totalApplied.plus(applied);
    } else {
      const billNumber = Number.parseInt(documentLabel, 10);
      if (!Number.isInteger(billNumber)) {
        errors.applications = `Could not read the bill number from ${documentLabel}.`;
        continue;
      }
      billApplications.push({ billNumber, amount: applied.toFixed(2) });
      totalApplied = totalApplied.plus(applied);
    }
  }

  return { applications, billApplications, totalApplied };
}

function parsePayment(
  formData: FormData,
): { draft: PaymentDraft } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const direction = formData.get("direction") === "SENT" ? "SENT" : "RECEIVED";

  const contactId = text(formData, "contactId");
  if (!contactId) errors.contactId = direction === "RECEIVED" ? "Choose a client." : "Choose a vendor.";

  const paymentDate = utcDate(text(formData, "paymentDate"));
  if (!paymentDate) errors.paymentDate = "Required.";

  const bankAccountCode = text(formData, "bankAccountCode");
  if (!bankAccountCode) errors.bankAccountCode = "Choose the account the money moved through.";

  const amountRaw = text(formData, "amount");
  let amount = new Decimal(0);
  try {
    amount = new Decimal(amountRaw ?? "0");
    if (amount.lessThanOrEqualTo(0)) errors.amount = "Must be greater than zero.";
  } catch {
    errors.amount = "Enter a number.";
  }

  const { applications, billApplications, totalApplied } = parseApplications(formData, errors);

  if (totalApplied.greaterThan(amount)) {
    errors.applications = `Applied ${totalApplied.toFixed(2)} exceeds the payment of ${amount.toFixed(2)}.`;
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    draft: {
      contactId: contactId!,
      direction,
      paymentDate: paymentDate!,
      amount: amount.toFixed(2),
      bankAccountCode: bankAccountCode!,
      method: text(formData, "method") ?? undefined,
      reference: text(formData, "reference") ?? undefined,
      notes: text(formData, "notes") ?? undefined,
      applications: applications.length > 0 ? applications : undefined,
      billApplications: billApplications.length > 0 ? billApplications : undefined,
    },
  };
}

export async function savePaymentAction(
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const parsed = parsePayment(formData);
  if ("errors" in parsed) {
    return { ok: false, message: "Check the highlighted fields.", errors: parsed.errors };
  }

  const id = text(formData, "id");
  const draft = { ...parsed.draft, postImmediately: formData.get("postImmediately") === "on" };

  // Leaving money unapplied while the contact has open documents is almost always a
  // mistake, so the form must say it was intended.
  const applied = sumApplied([...(draft.applications ?? []), ...(draft.billApplications ?? [])].map(
    (a) => ({ amountApplied: a.amount }),
  ));
  if (new Decimal(draft.amount).greaterThan(applied) && formData.get("confirmUnapplied") !== "on") {
    const open = await openDocumentLabels(draft.contactId, draft.direction, id);
    if (open.length > 0) {
      return {
        ok: false,
        message:
          `${new Decimal(draft.amount).minus(applied).toFixed(2)} is not applied, but ` +
          `${open.join(", ")} ${open.length === 1 ? "is" : "are"} still open. ` +
          `Enter the amount in the Apply column, or confirm you want it left unapplied.`,
        errors: { applications: "unconfirmed" },
      };
    }
  }

  try {
    if (id) await updateDraftPayment(id, draft);
    else await recordPayment(draft);
  } catch (e) {
    return { ok: false, message: (e as Error).message, errors: {} };
  }

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/bills");
  redirect("/payments");
}

async function openDocumentLabels(
  contactId: string,
  direction: "RECEIVED" | "SENT",
  excludePaymentId: string | null,
) {
  const notThisPayment = excludePaymentId ? { paymentId: { not: excludePaymentId } } : {};
  if (direction === "RECEIVED") {
    const invoices = await prisma.invoice.findMany({
      where: { contactId, status: "ISSUED" },
      include: { applications: { where: notThisPayment }, creditApplications: true },
    });
    return invoices
      .filter((i) =>
        new Decimal(i.total.toString())
          .minus(sumApplied(i.applications))
          .minus(sumApplied(i.creditApplications))
          .greaterThan(0),
      )
      .map((i) => i.invoiceNumber);
  }
  const bills = await prisma.bill.findMany({
    where: { contactId, status: "APPROVED" },
    include: { applications: { where: notThisPayment }, supplierCreditApplications: true },
  });
  return bills
    .filter((b) =>
      new Decimal(b.total.toString())
        .minus(sumApplied(b.applications))
        .minus(sumApplied(b.supplierCreditApplications))
        .greaterThan(0),
    )
    .map((b) => `bill #${b.billNumber}`);
}

export async function applyPaymentAction(
  paymentId: string,
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const errors: Record<string, string> = {};
  const applicationDate = utcDate(text(formData, "applicationDate"));
  if (!applicationDate) errors.applicationDate = "Required.";
  const { applications, billApplications } = parseApplications(formData, errors);
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  try {
    await applyPayment({ paymentId, applicationDate: applicationDate!, applications, billApplications });
  } catch (e) {
    return { ok: false, message: (e as Error).message, errors: {} };
  }

  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/bills");
  redirect("/payments");
}

export async function deletePaymentAction(paymentId: string) {
  await deleteDraftPayment(paymentId);
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath("/bills");
  redirect("/payments");
}
