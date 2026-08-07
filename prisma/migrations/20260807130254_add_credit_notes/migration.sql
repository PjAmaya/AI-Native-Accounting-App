-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'VOID');

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNumber" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "originalInvoiceId" TEXT,
    "creditDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivableAccountId" TEXT,
    "journalEntryId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "pdfHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "revenueAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditApplication" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_creditNumber_key" ON "CreditNote"("creditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_journalEntryId_key" ON "CreditNote"("journalEntryId");

-- CreateIndex
CREATE INDEX "CreditNote_contactId_idx" ON "CreditNote"("contactId");

-- CreateIndex
CREATE INDEX "CreditNote_status_idx" ON "CreditNote"("status");

-- CreateIndex
CREATE INDEX "CreditNote_creditDate_idx" ON "CreditNote"("creditDate");

-- CreateIndex
CREATE INDEX "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNoteLine_creditNoteId_lineNumber_key" ON "CreditNoteLine"("creditNoteId", "lineNumber");

-- CreateIndex
CREATE INDEX "CreditApplication_creditNoteId_idx" ON "CreditApplication"("creditNoteId");

-- CreateIndex
CREATE INDEX "CreditApplication_invoiceId_idx" ON "CreditApplication"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditApplication_creditNoteId_invoiceId_key" ON "CreditApplication"("creditNoteId", "invoiceId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
