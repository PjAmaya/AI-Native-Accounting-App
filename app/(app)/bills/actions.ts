"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBill, type BillDraft, type BillDraftLine } from "@/lib/invoicing/createBill";
import { approveBill } from "@/lib/invoicing/approveBill";
import { updateDraftBill, deleteDraftBill } from "@/lib/invoicing/updateDraftBill";
import { voidBill } from "@/lib/invoicing/voidBill";

export type BillFormState = {
  ok: boolean;
  message: string;
  warnings: string[];
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

export async function saveBillAction(
  _previous: BillFormState,
  formData: FormData,
): Promise<BillFormState> {
  const errors: Record<string, string> = {};

  const contactId = text(formData, "contactId");
  if (!contactId) errors.contactId = "Choose a vendor.";

  const supplierInvoiceNumber = text(formData, "supplierInvoiceNumber");
  if (!supplierInvoiceNumber) {
    errors.supplierInvoiceNumber = "Required — this is their invoice number, not yours.";
  }

  const billDate = utcDate(text(formData, "billDate"));
  if (!billDate) errors.billDate = "Required.";

  const dueDate = utcDate(text(formData, "dueDate"));
  if (dueDate && billDate && dueDate < billDate) {
    errors.dueDate = "Cannot be before the bill date.";
  }

  const descriptions = list(formData, "lineDescription");
  const amounts = list(formData, "lineAmount");
  const accounts = list(formData, "lineExpenseAccount");
  const projects = list(formData, "lineProject");
  const taxes = list(formData, "lineTaxRate");

  const lines: BillDraftLine[] = [];

  descriptions.forEach((description, i) => {
    const rawAmount = amounts[i] || null;
    if (!description && !rawAmount) return;

    if (!description) {
      errors[`line-${i}`] = "Needs a description.";
      return;
    }
    if (!rawAmount) {
      errors[`line-${i}`] = "Enter the amount from their invoice.";
      return;
    }

    let amount: Decimal;
    try {
      amount = new Decimal(rawAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } catch {
      errors[`line-${i}`] = "Amount must be a number.";
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

  const statedTax = text(formData, "taxTotal");
  if (statedTax) {
    try {
      new Decimal(statedTax);
    } catch {
      errors.taxTotal = "Must be a number.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", warnings: [], errors };
  }

  const draft: BillDraft = {
    contactId: contactId!,
    supplierInvoiceNumber: supplierInvoiceNumber!,
    billDate: billDate!,
    dueDate: dueDate ?? undefined,
    servicePeriodStart: utcDate(text(formData, "servicePeriodStart")) ?? undefined,
    servicePeriodEnd: utcDate(text(formData, "servicePeriodEnd")) ?? undefined,
    notes: text(formData, "notes") ?? undefined,
    projectCode: text(formData, "projectCode") ?? undefined,
    taxTotal: statedTax ?? undefined,
    acceptTaxVariance: formData.get("acceptTaxVariance") === "on",
    lines,
  };

  const id = text(formData, "id");
  let billId: string;

  try {
    const result = id ? await updateDraftBill(id, draft) : await createBill(draft);
    billId = result.bill.id;
  } catch (e) {
    return { ok: false, message: (e as Error).message, warnings: [], errors: {} };
  }

  revalidatePath("/bills");
  redirect(`/bills/${billId}`);
}

export async function voidBillAction(billId: string, formData: FormData) {
  const reason =
    typeof formData.get("reason") === "string" ? (formData.get("reason") as string).trim() : "";

  if (!reason) {
    redirect(`/bills/${billId}?voidError=${encodeURIComponent("A reason is required.")}`);
  }

  try {
    await voidBill(billId, { reason });
  } catch (e) {
    redirect(`/bills/${billId}?voidError=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/bills");
  redirect(`/bills/${billId}`);
}

export async function deleteBillAction(billId: string) {
  await deleteDraftBill(billId);
  revalidatePath("/bills");
  redirect("/bills");
}

export async function approveBillAction(billId: string) {
  await approveBill(billId);
  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
}
