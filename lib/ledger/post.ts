import { prisma } from "../db";
import { validateEntry, type DraftLine } from "./balance";

export type DraftEntry = {
  entryDate: Date;
  description: string;
  serviceDate?: Date;
  lines: DraftLine[];
};

export async function postEntry(draft: DraftEntry) {
  const validation = validateEntry(draft.lines);
  if (!validation.ok) {
    throw new Error(`Cannot post entry:\n${validation.errors.join("\n")}`);
  }

  return prisma.$transaction(async (tx) => {
    const codes = draft.lines.map((line) => line.accountCode);

    const accounts = await tx.account.findMany({
      where: { code: { in: codes } },
    });

    const byCode = new Map(accounts.map((a) => [a.code, a]));

    for (const code of codes) {
      const account = byCode.get(code);
      if (!account) {
        throw new Error(`Account ${code} does not exist.`);
      }
      if (!account.isActive) {
        throw new Error(`Account ${code} is inactive and cannot be posted to.`);
      }
      if (!account.isPostable) {
        throw new Error(`Account ${code} is a heading and cannot be posted to.`);
      }
    }

    const last = await tx.journalEntry.findFirst({
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    });
    const entryNumber = (last?.entryNumber ?? 0) + 1;

    return tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: draft.entryDate,
        serviceDate: draft.serviceDate ?? null,
        description: draft.description,
        status: "POSTED",
        postedAt: new Date(),
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