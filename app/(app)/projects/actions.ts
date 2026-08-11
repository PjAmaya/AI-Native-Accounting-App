"use server";

import Decimal from "decimal.js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { storeAttachment, deleteAttachment } from "@/lib/attachments/store";
import type { AttachmentKind } from "@/lib/generated/prisma/enums";

export type ProjectFormState = {
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

export async function saveProject(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const id = text(formData, "id");
  const errors: Record<string, string> = {};

  const code = text(formData, "code");
  const name = text(formData, "name");

  if (!code) errors.code = "Required.";
  if (!name) errors.name = "Required.";

  if (code) {
    const clash = await prisma.project.findUnique({ where: { code } });
    if (clash && clash.id !== id) errors.code = `${clash.code} is already ${clash.name}.`;
  }

  const startDate = utcDate(text(formData, "startDate"));
  const endDate = utcDate(text(formData, "endDate"));
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = "Cannot be before the start date.";
  }

  const contractRaw = text(formData, "contractValue");
  let contractValue: Decimal | null = null;
  if (contractRaw) {
    try {
      contractValue = new Decimal(contractRaw);
      if (contractValue.isNegative()) errors.contractValue = "Cannot be negative.";
    } catch {
      errors.contractValue = "Enter a number.";
    }
  }

  const budgetCodes = list(formData, "budgetAccount");
  const budgetAmounts = list(formData, "budgetAmount");
  const budgetNotes = list(formData, "budgetNote");

  const budgets: { code: string; amount: string; note: string | null }[] = [];

  budgetCodes.forEach((accountCode, i) => {
    const raw = budgetAmounts[i] || null;
    if (!accountCode && !raw) return;

    if (!accountCode) {
      errors[`budget-${i}`] = "Choose an account.";
      return;
    }
    if (!raw) {
      errors[`budget-${i}`] = "Enter a budget amount.";
      return;
    }

    let amount: Decimal;
    try {
      amount = new Decimal(raw).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } catch {
      errors[`budget-${i}`] = "Amount must be a number.";
      return;
    }
    if (amount.lessThanOrEqualTo(0)) {
      errors[`budget-${i}`] = "Enter a positive amount.";
      return;
    }

    budgets.push({ code: accountCode, amount: amount.toFixed(2), note: budgetNotes[i] || null });
  });

  const seen = new Set(budgets.map((b) => b.code));
  if (seen.size !== budgets.length) {
    errors.budgets = "Each account can appear only once.";
  }

  const accounts = await prisma.account.findMany({
    where: { code: { in: budgets.map((b) => b.code) } },
  });
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  for (const budget of budgets) {
    if (!accountByCode.has(budget.code)) errors.budgets = `Account ${budget.code} does not exist.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Check the highlighted fields.", errors };
  }

  const contactId = text(formData, "contactId");

  const status = (text(formData, "status") ?? "ACTIVE") as
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
  const closureReason = text(formData, "closureReason");

  if (status !== "ACTIVE" && !closureReason) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: { closureReason: "Say why — this is what makes the closure report useful." },
    };
  }

  const existing = id
    ? await prisma.project.findUnique({ where: { id }, select: { closedAt: true, status: true } })
    : null;

  const data = {
    code: code!,
    name: name!,
    contactId,
    status,
    scope: text(formData, "scope"),
    closureReason: status === "ACTIVE" ? null : closureReason,
    closedAt: status === "ACTIVE" ? null : (existing?.closedAt ?? new Date()),
    startDate,
    endDate,
    notes: text(formData, "notes"),
    contractValue: contractValue ? contractValue.toFixed(2) : null,
  };

  const projectId = await prisma.$transaction(async (tx) => {
    const project = id
      ? await tx.project.update({ where: { id }, data })
      : await tx.project.create({ data });

    await tx.projectBudgetLine.deleteMany({ where: { projectId: project.id } });

    for (const budget of budgets) {
      await tx.projectBudgetLine.create({
        data: {
          projectId: project.id,
          accountId: accountByCode.get(budget.code)!.id,
          amount: budget.amount,
          notes: budget.note,
        },
      });
    }

    return project.id;
  });

  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          lines: true,
          invoices: true,
          bills: true,
          invoiceLines: true,
          billLines: true,
          creditNoteLines: true,
          supplierCreditLines: true,
        },
      },
    },
  });

  if (!project) redirect("/projects");

  const c = project._count;
  const referenced =
    c.lines + c.invoices + c.bills + c.invoiceLines + c.billLines +
    c.creditNoteLines + c.supplierCreditLines;

  if (referenced > 0) {
    redirect(
      `/projects/${projectId}?error=` +
        encodeURIComponent(
          `${project.code} has ${referenced} linked record${referenced === 1 ? "" : "s"} and cannot be deleted. Mark it cancelled instead.`,
        ),
    );
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  redirect("/projects");
}

function fail(projectId: string, message: string): never {
  redirect(`/projects/${projectId}?error=${encodeURIComponent(message)}`);
}

export async function uploadProjectAttachment(projectId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    fail(projectId, "Choose a file to upload.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { contact: true },
  });
  if (!project) redirect("/projects");

  const kind = (text(formData, "kind") ?? "SHARED_DOCUMENT") as AttachmentKind;
  const documentDate = utcDate(text(formData, "documentDate")) ?? new Date();
  const description = text(formData, "description");

  const label =
    kind === "SERVICE_AGREEMENT"
      ? `${project.code} Service Agreement`
      : kind === "MILESTONE"
        ? `${project.code} ${description ?? "Milestone"}`
        : `${project.code} ${description ?? "Document"}`;

  try {
    await storeAttachment({
      file,
      kind,
      description,
      documentDate,
      contactName: project.contact?.name ?? null,
      documentLabel: label,
      projectId: project.id,
    });
  } catch (e) {
    fail(projectId, (e as Error).message);
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function removeProjectAttachment(projectId: string, attachmentId: string) {
  await deleteAttachment(attachmentId);
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
