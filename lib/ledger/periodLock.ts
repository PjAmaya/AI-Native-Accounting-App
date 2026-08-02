import { prisma } from "../db";
import type { TxClient } from "./txClient";

export type LockOverride = {
  reason: string;
  performedBy: string;
};

export type LockStatus = {
  softLockThrough: Date | null;
  hardLockThrough: Date | null;
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function lockStatusTx(tx: TxClient): Promise<LockStatus> {
  const profile = await tx.orgProfile.findUnique({ where: { id: "default" } });
  if (!profile) throw new Error("Org profile has not been seeded.");
  return {
    softLockThrough: profile.softLockThrough,
    hardLockThrough: profile.hardLockThrough,
  };
}

export async function assertPeriodOpenTx(
  tx: TxClient,
  entryDate: Date,
  override?: LockOverride,
  logOverride = true,
) {
  const { softLockThrough, hardLockThrough } = await lockStatusTx(tx);

  if (hardLockThrough && entryDate <= hardLockThrough) {
    throw new Error(
      `${iso(entryDate)} falls in a filed period (hard-locked through ${iso(hardLockThrough)}). ` +
        `Filed periods cannot be reopened - date this correction in the current period instead.`,
    );
  }

  if (softLockThrough && entryDate <= softLockThrough) {
    if (!override) {
      throw new Error(
        `${iso(entryDate)} falls in a closed period (soft-locked through ${iso(softLockThrough)}). ` +
          `Release the lock or post with an explicit override and reason.`,
      );
    }

    if (!logOverride) return;

    await tx.periodLockEvent.create({
      data: {
        action: "SOFT_LOCK_OVERRIDE",
        entryDate,
        newDate: softLockThrough,
        reason: override.reason,
        performedBy: override.performedBy,
      },
    });
  }
}

export async function setSoftLock(through: Date, performedBy: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const { softLockThrough, hardLockThrough } = await lockStatusTx(tx);

    if (hardLockThrough && through < hardLockThrough) {
      throw new Error(
        `Cannot set a soft lock at ${iso(through)} earlier than the hard lock at ${iso(hardLockThrough)}.`,
      );
    }

    await tx.periodLockEvent.create({
      data: {
        action: "SOFT_LOCK_SET",
        previousDate: softLockThrough,
        newDate: through,
        reason,
        performedBy,
      },
    });

    return tx.orgProfile.update({
      where: { id: "default" },
      data: { softLockThrough: through },
    });
  });
}

export async function releaseSoftLock(to: Date | null, performedBy: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to release a period lock.");

  return prisma.$transaction(async (tx) => {
    const { softLockThrough, hardLockThrough } = await lockStatusTx(tx);

    if (!softLockThrough) throw new Error("There is no soft lock to release.");
    if (to && to >= softLockThrough) {
      throw new Error("Releasing a lock must move the date earlier or clear it entirely.");
    }
    if (to && hardLockThrough && to < hardLockThrough) {
      throw new Error(
        `Cannot release past the hard lock at ${iso(hardLockThrough)}.`,
      );
    }
    if (!to && hardLockThrough) {
      throw new Error(
        `Cannot clear the soft lock entirely while a hard lock exists at ${iso(hardLockThrough)}.`,
      );
    }

    await tx.periodLockEvent.create({
      data: {
        action: "SOFT_LOCK_RELEASED",
        previousDate: softLockThrough,
        newDate: to,
        reason,
        performedBy,
      },
    });

    return tx.orgProfile.update({
      where: { id: "default" },
      data: { softLockThrough: to },
    });
  });
}

export async function setHardLock(through: Date, performedBy: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to hard-lock a period.");

  return prisma.$transaction(async (tx) => {
    const { softLockThrough, hardLockThrough } = await lockStatusTx(tx);

    if (hardLockThrough && through <= hardLockThrough) {
      throw new Error(
        `The hard lock is already at ${iso(hardLockThrough)} and can only move forward.`,
      );
    }

    await tx.periodLockEvent.create({
      data: {
        action: "HARD_LOCK_SET",
        previousDate: hardLockThrough,
        newDate: through,
        reason,
        performedBy,
      },
    });

    return tx.orgProfile.update({
      where: { id: "default" },
      data: {
        hardLockThrough: through,
        softLockThrough:
          softLockThrough && softLockThrough >= through ? softLockThrough : through,
      },
    });
  });
}

export async function lockHistory(limit = 50) {
  return prisma.periodLockEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
