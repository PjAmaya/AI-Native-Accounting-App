"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildDedupeKey } from "@/lib/dedupe";

export type ContactFormState = {
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

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function saveContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = text(formData, "id");
  const errors: Record<string, string> = {};

  const name = text(formData, "name");
  if (!name) errors.name = "Required.";

  const isCustomer = checked(formData, "isCustomer");
  const isVendor = checked(formData, "isVendor");
  if (!isCustomer && !isVendor) {
    errors.roles = "Pick at least one — a contact must be a customer, a vendor, or both.";
  }

  const addressLine1 = text(formData, "addressLine1");
  const city = text(formData, "city");
  const postalCode = text(formData, "postalCode");

  if (!postalCode) errors.postalCode = "Required — used to tell contacts apart.";

  if (isCustomer) {
    if (!addressLine1) errors.addressLine1 = "Required for customers — it prints on the invoice.";
    if (!city) errors.city = "Required for customers.";
  }

  const termsRaw = text(formData, "paymentTermsDays") ?? "30";
  const paymentTermsDays = Number.parseInt(termsRaw, 10);
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0) {
    errors.paymentTermsDays = "Enter a whole number of days.";
  }

  const receivableCode = text(formData, "receivableAccountCode");
  let receivableAccountId: string | null = null;
  if (receivableCode) {
    const account = await prisma.account.findUnique({ where: { code: receivableCode } });
    if (!account) errors.receivableAccountCode = "That account does not exist.";
    else if (!account.isPostable) errors.receivableAccountCode = "That account is a heading.";
    else if (account.type !== "ASSET") errors.receivableAccountCode = "Must be an asset account.";
    else receivableAccountId = account.id;
  }

  const dedupeKey = name && postalCode ? buildDedupeKey(name, postalCode) : null;

  if (dedupeKey) {
    const clash = await prisma.contact.findUnique({ where: { dedupeKey } });
    if (clash && clash.id !== id) {
      errors.name = `${clash.name} already exists at this postal code.`;
    }
  }

  if (name && !errors.name) {
    const legacy = await prisma.contact.findFirst({ where: { name, dedupeKey: null } });
    if (legacy && legacy.id !== id) {
      errors.name =
        `A contact named ${name} already exists without a postal code. ` +
        `Open that record and add one before creating a second.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  const data = {
    name: name!,
    isCustomer,
    isVendor,
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    addressLine1,
    addressLine2: text(formData, "addressLine2"),
    city,
    province: text(formData, "province"),
    postalCode,
    country: text(formData, "country") ?? "CA",
    businessNumber: text(formData, "businessNumber"),
    isHstRegistered: checked(formData, "isHstRegistered"),
    paymentTermsDays,
    notes: text(formData, "notes"),
      receivableAccountId,
    dedupeKey,
  };

  if (id) {
    await prisma.contact.update({ where: { id }, data });
  } else {
    await prisma.contact.create({ data });
  }

  revalidatePath("/contacts");
  redirect("/contacts");
}
