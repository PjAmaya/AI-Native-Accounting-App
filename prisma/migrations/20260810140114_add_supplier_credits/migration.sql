-- CreateEnum
CREATE TYPE "SupplierCreditStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED', 'REFUNDED', 'VOID');

-- CreateTable
CREATE TABLE "SupplierCredit" (
    "id" TEXT NOT NULL,
    "creditNumber" INTEGER NOT NULL,
    "supplierCreditNumber" TEXT NOT NULL,
    "status" "SupplierCreditStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "originalBillId" TEXT,
    "creditDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditLine" (
    "id" TEXT NOT NULL,
    "supplierCreditId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierCreditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCreditApplication" (
    "id" TEXT NOT NULL,
    "supplierCreditId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_creditNumber_key" ON "SupplierCredit"("creditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_journalEntryId_key" ON "SupplierCredit"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_refundEntryId_key" ON "SupplierCredit"("refundEntryId");

-- CreateIndex
CREATE INDEX "SupplierCredit_contactId_idx" ON "SupplierCredit"("contactId");

-- CreateIndex
CREATE INDEX "SupplierCredit_status_idx" ON "SupplierCredit"("status");

-- CreateIndex
CREATE INDEX "SupplierCredit_creditDate_idx" ON "SupplierCredit"("creditDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCredit_contactId_supplierCreditNumber_key" ON "SupplierCredit"("contactId", "supplierCreditNumber");

-- CreateIndex
CREATE INDEX "SupplierCreditLine_supplierCreditId_idx" ON "SupplierCreditLine"("supplierCreditId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCreditLine_supplierCreditId_lineNumber_key" ON "SupplierCreditLine"("supplierCreditId", "lineNumber");

-- CreateIndex
CREATE INDEX "SupplierCreditApplication_supplierCreditId_idx" ON "SupplierCreditApplication"("supplierCreditId");

-- CreateIndex
CREATE INDEX "SupplierCreditApplication_billId_idx" ON "SupplierCreditApplication"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCreditApplication_supplierCreditId_billId_key" ON "SupplierCreditApplication"("supplierCreditId", "billId");

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_originalBillId_fkey" FOREIGN KEY ("originalBillId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCredit" ADD CONSTRAINT "SupplierCredit_refundEntryId_fkey" FOREIGN KEY ("refundEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditLine" ADD CONSTRAINT "SupplierCreditLine_supplierCreditId_fkey" FOREIGN KEY ("supplierCreditId") REFERENCES "SupplierCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditLine" ADD CONSTRAINT "SupplierCreditLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditLine" ADD CONSTRAINT "SupplierCreditLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditLine" ADD CONSTRAINT "SupplierCreditLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditApplication" ADD CONSTRAINT "SupplierCreditApplication_supplierCreditId_fkey" FOREIGN KEY ("supplierCreditId") REFERENCES "SupplierCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditApplication" ADD CONSTRAINT "SupplierCreditApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
