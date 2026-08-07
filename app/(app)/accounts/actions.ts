"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type AccountFormState = {
  ok: boolean;
  message: string;
  errors: Record<string, string>;
  warnings?: string[];
  pendingName?: string;
} | null;

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
type SubType =
  | "CURRENT_ASSET" | "FIXED_ASSET" | "CURRENT_LIABILITY" | "LONG_TERM_LIABILITY"
  | "OWNERS_EQUITY" | "OPERATING_REVENUE" | "OTHER_INCOME" | "COST_OF_SERVICES"
  | "OPERATING_EXPENSE" | "OTHER_EXPENSE";
type AddBack = "NONE" | "DEPRECIATION" | "AMORTIZATION" | "INTEREST" | "INCOME_TAX";

const SUBTYPES_BY_TYPE: Record<AccountType, SubType[]> = {
  ASSET: ["CURRENT_ASSET", "FIXED_ASSET"],
  LIABILITY: ["CURRENT_LIABILITY", "LONG_TERM_LIABILITY"],
  EQUITY: ["OWNERS_EQUITY"],
  REVENUE: ["OPERATING_REVENUE", "OTHER_INCOME"],
  EXPENSE: ["COST_OF_SERVICES", "OPERATING_EXPENSE", "OTHER_EXPENSE"],
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function saveAccount(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const id = text(formData, "id");
  const errors: Record<string, string> = {};

  const code = text(formData, "code");
  const name = text(formData, "name");
  const type = text(formData, "type") as AccountType | null;
  const subType = text(formData, "subType") as SubType | null;
  const normalBalance = text(formData, "normalBalance") as "DEBIT" | "CREDIT" | null;

  if (!code) errors.code = "Required.";
  else if (!/^\d{4}$/.test(code)) errors.code = "Four digits, for example 6110.";

  if (!name) errors.name = "Required.";
  if (!type) errors.type = "Required.";
  if (!normalBalance) errors.normalBalance = "Required.";

  if (type && subType && !SUBTYPES_BY_TYPE[type].includes(subType)) {
    errors.subType = `Not valid for a ${type.toLowerCase()} account.`;
  }
  if (!subType) errors.subType = "Required.";

  const existing = id
    ? await prisma.account.findUnique({
        where: { id },
        include: { _count: { select: { lines: true } } },
      })
    : null;

  if (id && !existing) errors.code = "This account no longer exists.";

  const hasPostings = (existing?._count.lines ?? 0) > 0;

  if (existing && hasPostings) {
    if (existing.code !== code) errors.code = "Cannot change the code of an account with postings.";
    if (existing.type !== type) errors.type = "Cannot change the type of an account with postings.";
    if (existing.subType !== subType) errors.subType = "Cannot change the sub-type of an account with postings.";
    if (existing.normalBalance !== normalBalance) {
      errors.normalBalance = "Cannot change the normal balance of an account with postings.";
    }
  }

  if (code) {
    const clash = await prisma.account.findUnique({ where: { code } });
    if (clash && clash.id !== id) errors.code = `${clash.code} is already ${clash.name}.`;
  }

  const parentCode = text(formData, "parentCode");
  let parentId: string | null = null;
  if (parentCode) {
    const parent = await prisma.account.findUnique({ where: { code: parentCode } });
    if (!parent) errors.parentCode = "That account does not exist.";
    else if (parent.id === id) errors.parentCode = "An account cannot be its own parent.";
    else parentId = parent.id;
  }

  const isPostable = checked(formData, "isPostable");
  if (existing && hasPostings && !isPostable) {
    errors.isPostable = "This account has postings, so it cannot become a heading.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  const acknowledged = text(formData, "acknowledgedName");

  if (name && acknowledged !== name) {
    const sameName = await prisma.account.findMany({
      where: { name: { equals: name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) },
      orderBy: { code: "asc" },
    });

    if (sameName.length > 0) {
      return {
        ok: false,
        message: "Two accounts would share this name.",
        errors: {},
        pendingName: name,
        warnings: sameName.map(
          (a) =>
            `${a.code} is already called "${a.name}". Duplicate names make it hard to tell them apart ` +
            `on reports and in the assistant. Save again to keep this name anyway.`,
        ),
      };
    }
  }

  const data = {
    code: code!,
    name: name!,
    type: type!,
    subType: subType!,
    normalBalance: normalBalance!,
    isPostable,
    isActive: checked(formData, "isActive"),
    capitalCandidate: checked(formData, "capitalCandidate"),
    ebitdaAddBack: (text(formData, "ebitdaAddBack") ?? "NONE") as AddBack,
    parentId,
  };

  if (id) {
    await prisma.account.update({ where: { id }, data });
  } else {
    await prisma.account.create({ data });
  }

  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function deleteAccount(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      _count: {
        select: {
          lines: true,
          children: true,
          invoiceLines: true,
          billLines: true,
          receivableFor: true,
          receivableForInvoices: true,
          taxCollectedFor: true,
          taxRecoverableFor: true,
          paymentsReceived: true,
        },
      },
    },
  });

  if (!account) redirect("/accounts");

  const c = account._count;
  const blockers =
    c.lines + c.invoiceLines + c.billLines + c.children +
    c.receivableFor + c.receivableForInvoices +
    c.taxCollectedFor + c.taxRecoverableFor + c.paymentsReceived;

  if (blockers > 0) {
    await prisma.account.update({ where: { id: accountId }, data: { isActive: false } });
  } else {
    await prisma.account.delete({ where: { id: accountId } });
  }

  revalidatePath("/accounts");
  redirect("/accounts");
}
