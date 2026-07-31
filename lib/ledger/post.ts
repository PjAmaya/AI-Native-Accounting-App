import { prisma } from "../db";
import { validateEntry, type DraftLine } from "./balance";

export type DraftEntry = {
  entryDate: Date;
  description: string;
  serviceDate?: Date;
  lines: DraftLine[];
};

type PostableAccount = {
  id: string;
  code: string;
  isActive: boolean;
  isPostable: boolean;
};

function assertPostable(accounts: PostableAccount[], codes: string[]) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));

  for (const code of codes) {
    const account = byCode.get(code);
    if (!account) throw new Error(`Account ${code} does not exist.`);
    if (!account.isActive) throw new Error(`Account ${code} is inactive and cannot be posted to.`);
    if (!account.isPostable) throw new Error(`Account ${code} is a heading and cannot be posted to.`);
  }

  return byCode;
}

export async function createDraftEntry(draft: DraftEntry) {
  const validation = validateEntry(draft.lines);
  if (!validation.ok) {
    throw new Error(`Cannot create entry:\n${validation.errors.join("\n")}`);
  }

  return prisma.$transaction(async (tx) => {
    const codes = draft.lines.map((line) => line.accountCode);
    const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
    const byCode = assertPostable(accounts, codes);

    const last = await tx.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    });

    return tx.journalEntry.create({
      data: {
        entryNumber: (last?.entryNumber ?? 0) + 1,
        entryDate: draft.entryDate,
        serviceDate: draft.serviceDate ?? null,
        description: draft.description,
        status: "DRAFT",
        lines: {
          create: draft.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: byCode.get(line.accountCode)!.id,
            description: line.description ?? null,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
      include: { lines: true },
    });
  });
}

export async function postDraft(entryId: string) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: { include: { account: true } } },
    });

    if (!entry) throw new Error(`Entry ${entryId} does not exist.`);
    if (entry.status === "POSTED") throw new Error(`Entry #${entry.entryNumber} is already posted.`);
    if (entry.status === "REVERSED") throw new Error(`Entry #${entry.entryNumber} is reversed and cannot be posted.`);

    const codes = entry.lines.map((line) => line.account.code);
    assertPostable(entry.lines.map((line) => line.account), codes);

    const validation = validateEntry(
      entry.lines.map((line) => ({
        accountCode: line.account.code,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
      })),
    );
    if (!validation.ok) {
      throw new Error(`Cannot post entry #${entry.entryNumber}:\n${validation.errors.join("\n")}`);
    }

    return tx.journalEntry.update({
      where: { id: entryId },
      data: { status: "POSTED", postedAt: new Date() },
      include: { lines: true },
    });
  });
}

export async function postEntry(draft: DraftEntry) {
  const created = await createDraftEntry(draft);
  return postDraft(created.id);
}
export async function reverseEntry(entryId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });

    if (!original) throw new Error(`Entry ${entryId} does not exist.`);
    if (original.status === "DRAFT") {
      throw new Error(`Entry #${original.entryNumber} is a draft — delete it instead of reversing it.`);
    }
    if (original.status === "REVERSED") {
      throw new Error(`Entry #${original.entryNumber} has already been reversed.`);
    }

    const last = await tx.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    });

    const reversal = await tx.journalEntry.create({
      data: {
        entryNumber: (last?.entryNumber ?? 0) + 1,
        entryDate: original.entryDate,
        serviceDate: original.serviceDate,
        description:
          `Reversal of #${original.entryNumber} - ${original.description}` +
          (reason ? ` (${reason})` : ""),
        status: "POSTED",
        postedAt: new Date(),
        reversalOfId: original.id,
        lines: {
          create: original.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            description: line.description,
            debit: line.credit,
            credit: line.debit,
            currency: line.currency,
            exchangeRate: line.exchangeRate,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.journalEntry.update({
      where: { id: original.id },
      data: { status: "REVERSED" },
    });

    return reversal;
  });
}