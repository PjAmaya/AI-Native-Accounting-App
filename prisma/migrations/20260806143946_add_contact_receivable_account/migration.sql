-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "receivableAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
