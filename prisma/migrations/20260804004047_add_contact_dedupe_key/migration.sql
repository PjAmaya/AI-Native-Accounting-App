/*
  Warnings:

  - A unique constraint covering the columns `[dedupeKey]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_dedupeKey_key" ON "Contact"("dedupeKey");
