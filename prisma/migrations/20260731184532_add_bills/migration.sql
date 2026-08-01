-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" INTEGER NOT NULL,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "projectId" TEXT,
    "billDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "servicePeriodStart" DATE,
    "servicePeriodEnd" DATE,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "documentPath" TEXT,
    "documentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4),
    "unitRate" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillApplication" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_journalEntryId_key" ON "Bill"("journalEntryId");

-- CreateIndex
CREATE INDEX "Bill_contactId_idx" ON "Bill"("contactId");

-- CreateIndex
CREATE INDEX "Bill_projectId_idx" ON "Bill"("projectId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_contactId_supplierInvoiceNumber_key" ON "Bill"("contactId", "supplierInvoiceNumber");

-- CreateIndex
CREATE INDEX "BillLine_billId_idx" ON "BillLine"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillLine_billId_lineNumber_key" ON "BillLine"("billId", "lineNumber");

-- CreateIndex
CREATE INDEX "BillApplication_paymentId_idx" ON "BillApplication"("paymentId");

-- CreateIndex
CREATE INDEX "BillApplication_billId_idx" ON "BillApplication"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillApplication_paymentId_billId_key" ON "BillApplication"("paymentId", "billId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillApplication" ADD CONSTRAINT "BillApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillApplication" ADD CONSTRAINT "BillApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bill arithmetic must hold; on a bill this catches transcription errors
ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_total_matches"
  CHECK ("total" = "subtotal" + "taxTotal");

ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_due_not_before_bill_date"
  CHECK ("dueDate" >= "billDate");

ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_service_period_ordered"
  CHECK (
    "servicePeriodStart" IS NULL
    OR "servicePeriodEnd" IS NULL
    OR "servicePeriodEnd" >= "servicePeriodStart"
  );

ALTER TABLE "Bill"
  ADD CONSTRAINT "Bill_exchange_rate_positive"
  CHECK ("exchangeRate" > 0);

ALTER TABLE "BillApplication"
  ADD CONSTRAINT "BillApplication_amount_positive"
  CHECK ("amountApplied" > 0);
