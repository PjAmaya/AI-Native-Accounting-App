-- AlterTable
ALTER TABLE "BillApplication" ADD COLUMN     "journalEntryId" TEXT;

-- AlterTable
ALTER TABLE "PaymentApplication" ADD COLUMN     "journalEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BillApplication_journalEntryId_key" ON "BillApplication"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApplication_journalEntryId_key" ON "PaymentApplication"("journalEntryId");

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillApplication" ADD CONSTRAINT "BillApplication_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

