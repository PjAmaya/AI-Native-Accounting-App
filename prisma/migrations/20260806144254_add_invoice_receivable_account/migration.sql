-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "receivableAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
