"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createInvoice, type InvoiceDraft, type InvoiceDraftLine } from "@/lib/invoicing/createInvoice";
import { updateDraftInvoice, deleteDraftInvoice } from "@/lib/invoicing/updateDraftInvoice";
import { issueInvoice } from "@/lib/invoicing/issueInvoice";
import { voidInvoice } from "@/lib/invoicing/voidInvoice";

export type InvoiceFormState = {
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

function parseInvoice(formData: FormData): { draft: InvoiceDraft } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const contactId = text(formData, "contactId");
  if (!contactId) errors.contactId = "Choose a client.";

  const invoiceDate = utcDate(text(formData, "invoiceDate"));
  if (!invoiceDate) errors.invoiceDate = "Required.";

  const dueDate = utcDate(text(formData, "dueDate"));
  if (dueDate && invoiceDate && dueDate < invoiceDate) {
    errors.dueDate = "Cannot be before the invoice date.";
  }

  const descriptions = list(formData, "lineDescription");
  const quantities = list(formData, "lineQuantity");
  const rates = list(formData, "lineUnitRate");
  const accounts = list(formData, "lineRevenueAccount");
  const projects = list(formData, "lineProject");
  const taxes = list(formData, "lineTaxRate");

  const lines: InvoiceDraftLine[] = [];

  descriptions.forEach((description, i) => {
    const quantity = quantities[i] || null;
    const unitRate = rates[i] || null;

    if (!description && !unitRate) return;

    if (!description) {
      errors[`line-${i}`] = "Needs a description.";
      return;
    }
    if (!quantity || !unitRate) {
      errors[`line-${i}`] = "Enter a quantity and a rate.";
      return;
    }

    let amount: Decimal;
    try {
      amount = new Decimal(quantity)
        .times(unitRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } catch {
      errors[`line-${i}`] = "Quantity and rate must be numbers.";
      return;
    }
    if (amount.isZero()) {
      errors[`line-${i}`] = "Amount works out to zero.";
      return;
    }

    lines.push({
      description,
      amount: amount.toFixed(2),
      quantity: quantity || undefined,
      unitRate: unitRate || undefined,
      revenueAccountCode: accounts[i] || "4010",
      projectCode: projects[i] || undefined,
      taxRateCode: taxes[i] || undefined,
    });
  });

  if (lines.length === 0) errors.lines = "Add at least one line.";

  if (Object.keys(errors).length > 0) return { errors };

  return {
    draft: {
      contactId: contactId!,
      invoiceDate: invoiceDate!,
      dueDate: dueDate ?? undefined,
      servicePeriodStart: utcDate(text(formData, "servicePeriodStart")) ?? undefined,
      servicePeriodEnd: utcDate(text(formData, "servicePeriodEnd")) ?? undefined,
      clientReference: text(formData, "clientReference") ?? undefined,
      notes: text(formData, "notes") ?? undefined,
      projectCode: text(formData, "projectCode") ?? undefined,
      lines,
    },
  };
}

export async function saveInvoiceAction(
  _previous: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const parsed = parseInvoice(formData);
  if ("errors" in parsed) {
    return { ok: false, message: "Check the highlighted fields.", errors: parsed.errors };
  }

  const id = text(formData, "id");
  let invoiceId: string;

  try {
    if (id) {
      const { invoice } = await updateDraftInvoice(id, parsed.draft);
      invoiceId = invoice.id;
    } else {
      const { invoice } = await createInvoice(parsed.draft);
      invoiceId = invoice.id;
    }
  } catch (e) {
    return { ok: false, message: (e as Error).message, errors: {} };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(invoiceId: string) {
  await deleteDraftInvoice(invoiceId);
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function voidInvoiceAction(invoiceId: string, formData: FormData) {
  const reason = typeof formData.get("reason") === "string"
    ? (formData.get("reason") as string).trim()
    : "";

  if (!reason) {
    redirect(`/invoices/${invoiceId}?voidError=${encodeURIComponent("A reason is required.")}`);
  }

  try {
    await voidInvoice(invoiceId, { reason });
  } catch (e) {
    redirect(`/invoices/${invoiceId}?voidError=${encodeURIComponent((e as Error).message)}`);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function issueInvoiceAction(invoiceId: string) {
  await issueInvoice(invoiceId);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
}
