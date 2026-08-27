-- DropIndex
DROP INDEX "ProjectBudgetLine_projectId_accountId_key";

-- AlterTable
ALTER TABLE "ProjectBudgetLine" ADD COLUMN     "label" TEXT;
