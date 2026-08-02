-- CreateEnum
CREATE TYPE "PeriodLockAction" AS ENUM ('SOFT_LOCK_SET', 'SOFT_LOCK_RELEASED', 'HARD_LOCK_SET', 'SOFT_LOCK_OVERRIDE');

-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "hardLockThrough" DATE,
ADD COLUMN     "softLockThrough" DATE;

-- CreateTable
CREATE TABLE "PeriodLockEvent" (
    "id" TEXT NOT NULL,
    "action" "PeriodLockAction" NOT NULL,
    "previousDate" DATE,
    "newDate" DATE,
    "entryDate" DATE,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodLockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodLockEvent_createdAt_idx" ON "PeriodLockEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PeriodLockEvent_action_idx" ON "PeriodLockEvent"("action");
