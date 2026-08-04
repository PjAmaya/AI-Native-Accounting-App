"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordPayment, type PaymentDraft } from "@/lib/invoicing/recordPayment";
import { updateDraftPayment, deleteDraftPayment } from "@/lib/invoicing/updateDraftPayment";
import { postDraft } from "@/lib/ledger/post";

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

  try {
    const result = id
      ? await updateDraftPayment(id, parsed.draft)
      : await recordPayment(parsed.draft);

    if (formData.get("postImmediately") === "on") {
      await postDraft(result.entry.id);
    }
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
