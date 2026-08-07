"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCreditNote, type CreditNoteDraftLine } from "@/lib/invoicing/createCreditNote";
import { issueCreditNote, applyCredit, refundCreditNote } from "@/lib/invoicing/creditNoteOps";

export type CreditFormState = {
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

function list(formData: FormData, key: string) {
  return formData.getAll(key).map((v) => (typeof v === "string" ? v.trim() : ""));
}

export async function createCreditNoteAction(
  _previous: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const errors: Record<string, string> = {};

  const contactId = text(formData, "contactId");
  if (!contactId) errors.contactId = "Choose a client.";

  const reason = text(formData, "reason");
  if (!reason) errors.reason = "Required — this prints on the credit note.";

  const creditDate = utcDate(text(formData, "creditDate"));
  if (!creditDate) errors.creditDate = "Required.";

  const descriptions = list(formData, "lineDescription");
  const amounts = list(formData, "lineAmount");
  const accounts = list(formData, "lineRevenueAccount");
  const projects = list(formData, "lineProject");
  const taxes = list(formData, "lineTaxRate");

  const lines: CreditNoteDraftLine[] = [];

  descriptions.forEach((description, i) => {
    const rawAmount = amounts[i] || null;
    if (!description && !rawAmount) return;

    if (!description) {
      errors[`line-${i}`] = "Needs a description.";
      return;
    }
    if (!rawAmount) {
      errors[`line-${i}`] = "Enter the amount being credited.";
      return;
    }

    let amount: Decimal;
    try {
      amount = new Decimal(rawAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } catch {
      errors[`line-${i}`] = "Amount must be a number.";
      return;
    }
    if (amount.lessThanOrEqualTo(0)) {
      errors[`line-${i}`] = "Enter a positive amount — the credit direction is automatic.";
      return;
    }

    lines.push({
      description,
      amount: amount.toFixed(2),
      revenueAccountCode: accounts[i] || "",
      projectCode: projects[i] || undefined,
      taxRateCode: taxes[i] || undefined,
    });
  });

  if (lines.length === 0) errors.lines = "Add at least one line.";
  if (lines.some((l) => !l.revenueAccountCode)) errors.lines = "Every line needs an account.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  let creditNoteId: string;

  try {
    const result = await createCreditNote({
      contactId: contactId!,
      originalInvoiceId: text(formData, "originalInvoiceId") ?? undefined,
      creditDate: creditDate!,
      reason: reason!,
      notes: text(formData, "notes") ?? undefined,
      lines,
    });
    creditNoteId = result.creditNote.id;
  } catch (e) {
    return { ok: false, message: (e as Error).message, errors: {} };
  }

  revalidatePath("/credit-notes");
  redirect(`/credit-notes/${creditNoteId}`);
}

export async function issueCreditNoteAction(creditNoteId: string) {
  await issueCreditNote(creditNoteId);
  revalidatePath("/credit-notes");
  revalidatePath("/invoices");
  redirect(`/credit-notes/${creditNoteId}`);
}

export async function applyCreditAction(creditNoteId: string, formData: FormData) {
  const applications: { invoiceNumber: string; amount: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("apply:")) continue;
    if (typeof value !== "string" || value.trim() === "") continue;
    try {
      const amount = new Decimal(value);
      if (amount.greaterThan(0)) {
        applications.push({
          invoiceNumber: key.slice("apply:".length),
          amount: amount.toFixed(2),
        });
      }
    } catch {
      redirect(`/credit-notes/${creditNoteId}?error=${encodeURIComponent("Amounts must be numbers.")}`);
    }
  }

  if (applications.length === 0) {
    redirect(`/credit-notes/${creditNoteId}?error=${encodeURIComponent("Enter at least one amount.")}`);
  }

  try {
    await applyCredit(creditNoteId, applications);
  } catch (e) {
    redirect(`/credit-notes/${creditNoteId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/credit-notes");
  revalidatePath("/invoices");
  redirect(`/credit-notes/${creditNoteId}`);
}

export async function refundCreditNoteAction(creditNoteId: string, formData: FormData) {
  const amount = text(formData, "amount");
  const bankAccountCode = text(formData, "bankAccountCode");
  const refundDate = utcDate(text(formData, "refundDate"));

  if (!amount || !bankAccountCode || !refundDate) {
    redirect(
      `/credit-notes/${creditNoteId}?error=${encodeURIComponent("Amount, account and date are all required.")}`,
    );
  }

  try {
    await refundCreditNote(creditNoteId, {
      amount: amount!,
      bankAccountCode: bankAccountCode!,
      refundDate: refundDate!,
      reference: text(formData, "reference") ?? undefined,
    });
  } catch (e) {
    redirect(`/credit-notes/${creditNoteId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/credit-notes");
  redirect(`/credit-notes/${creditNoteId}`);
}
