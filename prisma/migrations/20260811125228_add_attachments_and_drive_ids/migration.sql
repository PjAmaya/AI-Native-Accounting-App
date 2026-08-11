-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('SERVICE_AGREEMENT', 'MILESTONE', 'SHARED_DOCUMENT', 'SOURCE_DOCUMENT', 'SUPPORTING');

-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "driveApBillsId" TEXT,
ADD COLUMN     "driveArInvoicesId" TEXT,
ADD COLUMN     "driveCreditNotesId" TEXT,
ADD COLUMN     "driveFinancialRootId" TEXT,
ADD COLUMN     "driveProjectsRootId" TEXT,
ADD COLUMN     "driveSupplierCreditsId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "driveFolderUrl" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'SUPPORTING',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveWebLink" TEXT,
    "driveSyncedAt" TIMESTAMP(3),
    "driveError" TEXT,
    "description" TEXT,
    "uploadedBy" TEXT,
    "projectId" TEXT,
    "billId" TEXT,
    "supplierCreditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");

-- CreateIndex
CREATE INDEX "Attachment_billId_idx" ON "Attachment"("billId");

-- CreateIndex
CREATE INDEX "Attachment_supplierCreditId_idx" ON "Attachment"("supplierCreditId");

-- CreateIndex
CREATE INDEX "Attachment_sha256_idx" ON "Attachment"("sha256");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_supplierCreditId_fkey" FOREIGN KEY ("supplierCreditId") REFERENCES "SupplierCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
