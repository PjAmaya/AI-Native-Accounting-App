-- CreateEnum
CREATE TYPE "EbitdaAddBack" AS ENUM ('NONE', 'DEPRECIATION', 'AMORTIZATION', 'INTEREST', 'INCOME_TAX');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "ebitdaAddBack" "EbitdaAddBack" NOT NULL DEFAULT 'NONE';
