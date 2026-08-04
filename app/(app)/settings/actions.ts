"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type FormState = {
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

export async function saveOrgProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const errors: Record<string, string> = {};

  const legalName = text(formData, "legalName");
  if (!legalName) errors.legalName = "Required — this is the name on the invoice.";

  const thresholdRaw = text(formData, "capitalizationThreshold") ?? "500";
  let threshold = new Decimal(0);
  try {
    threshold = new Decimal(thresholdRaw);
    if (threshold.isNegative()) errors.capitalizationThreshold = "Cannot be negative.";
  } catch {
    errors.capitalizationThreshold = "Enter a number, for example 500.";
  }

  const hstRaw = text(formData, "hstRegisteredFrom");
  let hstRegisteredFrom: Date | null = null;
  if (hstRaw) {
    const parsed = new Date(`${hstRaw}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      errors.hstRegisteredFrom = "Enter a valid date.";
    } else {
      hstRegisteredFrom = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  await prisma.orgProfile.update({
    where: { id: "default" },
    data: {
      legalName: legalName!,
      tradeName: text(formData, "tradeName"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      addressLine1: text(formData, "addressLine1"),
      addressLine2: text(formData, "addressLine2"),
      city: text(formData, "city"),
      province: text(formData, "province"),
      postalCode: text(formData, "postalCode"),
      country: text(formData, "country") ?? "CA",
      businessNumber: text(formData, "businessNumber"),
      hstRegisteredFrom,
      paymentInstructions: text(formData, "paymentInstructions"),
      invoiceFooter: text(formData, "invoiceFooter"),
      capitalizationThreshold: threshold.toFixed(2),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");

  return { ok: true, message: "Saved.", errors: {} };
}
