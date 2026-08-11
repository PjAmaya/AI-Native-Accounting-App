"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupplierCredit, type SupplierCreditDraftLine } from "@/lib/invoicing/supplierCredit";
import {
  approveSupplierCredit,
  applySupplierCredit,
  refundSupplierCredit,
} from "@/lib/invoicing/supplierCreditOps";
import {
  updateDraftSupplierCredit,
  deleteDraftSupplierCredit,
  voidSupplierCredit,
} from "@/lib/invoicing/updateSupplierCredit";

export type SupplierCreditFormState = {
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

export async function saveSupplierCreditAction(
  _previous: SupplierCreditFormState,
  formData: FormData,
): Promise<SupplierCreditFormState> {
  const errors: Record<string, string> = {};

  const contactId = text(formData, "contactId");
  if (!contactId) errors.contactId = "Choose a vendor.";

  const supplierCreditNumber = text(formData, "supplierCreditNumber");
  if (!supplierCreditNumber) {
    errors.supplierCreditNumber = "Required — their credit note number, not yours.";
  }

  const reason = text(formData, "reason");
  if (!reason) errors.reason = "Required.";

  const creditDate = utcDate(text(formData, "creditDate"));
  if (!creditDate) errors.creditDate = "Required.";

  const descriptions = list(formData, "lineDescription");
  const amounts = list(formData, "lineAmount");
  const accounts = list(formData, "lineExpenseAccount");
  const projects = list(formData, "lineProject");
  const taxes = list(formData, "lineTaxRate");

  const lines: SupplierCreditDraftLine[] = [];

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
      expenseAccountCode: accounts[i] || "",
      projectCode: projects[i] || undefined,
      taxRateCode: taxes[i] || undefined,
    });
  });

  if (lines.length === 0) errors.lines = "Add at least one line.";
  if (lines.some((l) => !l.expenseAccountCode)) errors.lines = "Every line needs an account.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  const id = text(formData, "id");
  let creditId: string;

  const draft = {
    contactId: contactId!,
    supplierCreditNumber: supplierCreditNumber!,
    originalBillId: text(formData, "originalBillId") ?? undefined,
    creditDate: creditDate!,
    reason: reason!,
    notes: text(formData, "notes") ?? undefined,
    taxTotal: text(formData, "taxTotal") ?? undefined,
    lines,
  };

  try {
    const result = id
      ? await updateDraftSupplierCredit(id, draft)
      : await createSupplierCredit(draft);
    creditId = result.credit.id;
  } catch (e) {
    return { ok: false, message: (e as Error).message, errors: {} };
  }

  revalidatePath("/supplier-credits");
  redirect(`/supplier-credits/${creditId}`);
}

export async function deleteSupplierCreditAction(creditId: string) {
  await deleteDraftSupplierCredit(creditId);
  revalidatePath("/supplier-credits");
  redirect("/supplier-credits");
}

export async function voidSupplierCreditAction(creditId: string, formData: FormData) {
  const reason =
    typeof formData.get("reason") === "string" ? (formData.get("reason") as string).trim() : "";

  if (!reason) {
    redirect(`/supplier-credits/${creditId}?error=${encodeURIComponent("A reason is required.")}`);
  }

  try {
    await voidSupplierCredit(creditId, { reason });
  } catch (e) {
    redirect(`/supplier-credits/${creditId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/supplier-credits");
  revalidatePath("/bills");
  redirect(`/supplier-credits/${creditId}`);
}

export async function approveSupplierCreditAction(creditId: string) {
  await approveSupplierCredit(creditId);
  revalidatePath("/supplier-credits");
  revalidatePath("/bills");
  redirect(`/supplier-credits/${creditId}`);
}

export async function applySupplierCreditAction(creditId: string, formData: FormData) {
  const applications: { billNumber: number; amount: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("apply:")) continue;
    if (typeof value !== "string" || value.trim() === "") continue;

    const billNumber = Number.parseInt(key.slice("apply:".length), 10);
    if (!Number.isInteger(billNumber)) continue;

    try {
      const amount = new Decimal(value);
      if (amount.greaterThan(0)) {
        applications.push({ billNumber, amount: amount.toFixed(2) });
      }
    } catch {
      redirect(
        `/supplier-credits/${creditId}?error=${encodeURIComponent("Amounts must be numbers.")}`,
      );
    }
  }

  if (applications.length === 0) {
    redirect(
      `/supplier-credits/${creditId}?error=${encodeURIComponent("Enter at least one amount.")}`,
    );
  }

  try {
    await applySupplierCredit(creditId, applications);
  } catch (e) {
    redirect(`/supplier-credits/${creditId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/supplier-credits");
  revalidatePath("/bills");
  redirect(`/supplier-credits/${creditId}`);
}

export async function refundSupplierCreditAction(creditId: string, formData: FormData) {
  const amount = text(formData, "amount");
  const bankAccountCode = text(formData, "bankAccountCode");
  const refundDate = utcDate(text(formData, "refundDate"));

  if (!amount || !bankAccountCode || !refundDate) {
    redirect(
      `/supplier-credits/${creditId}?error=${encodeURIComponent("Amount, account and date are all required.")}`,
    );
  }

  try {
    await refundSupplierCredit(creditId, {
      amount: amount!,
      bankAccountCode: bankAccountCode!,
      refundDate: refundDate!,
      reference: text(formData, "reference") ?? undefined,
    });
  } catch (e) {
    redirect(`/supplier-credits/${creditId}?error=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/supplier-credits");
  redirect(`/supplier-credits/${creditId}`);
}
