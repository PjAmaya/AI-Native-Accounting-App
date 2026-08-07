/*
  Warnings:

  - A unique constraint covering the columns `[refundEntryId]` on the table `CreditNote` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "CreditNoteStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "refundEntryId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_refundEntryId_key" ON "CreditNote"("refundEntryId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_refundEntryId_fkey" FOREIGN KEY ("refundEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
