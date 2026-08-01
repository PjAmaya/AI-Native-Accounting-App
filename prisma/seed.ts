import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

const accounts = [
  { code: "1000", name: "Cash & Bank",                          type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: false, parentCode: null },
  { code: "1010", name: "Operating Chequing",                   type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: "1000" },
  { code: "1020", name: "Tax & Savings Reserve",                type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: "1000" },
  { code: "1030", name: "Merchant Clearing",                    type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: "1000" },
  { code: "1200", name: "Accounts Receivable",                  type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "1250", name: "HST Recoverable (ITCs)",               type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "1300", name: "Prepaid Expenses",                     type: "ASSET",     subType: "CURRENT_ASSET",       normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "1400", name: "Fixed Assets",                         type: "ASSET",     subType: "FIXED_ASSET",         normalBalance: "DEBIT",  isPostable: false, parentCode: null },
  { code: "1410", name: "Computer Hardware - at cost",          type: "ASSET",     subType: "FIXED_ASSET",         normalBalance: "DEBIT",  isPostable: true,  parentCode: "1400" },
  { code: "1415", name: "Accum. Depreciation - Hardware",       type: "ASSET",     subType: "FIXED_ASSET",         normalBalance: "CREDIT", isPostable: true,  parentCode: "1400" },
  { code: "1420", name: "Automobile - at cost",                 type: "ASSET",     subType: "FIXED_ASSET",         normalBalance: "DEBIT",  isPostable: true,  parentCode: "1400" },
  { code: "1425", name: "Accum. Depreciation - Automobile",     type: "ASSET",     subType: "FIXED_ASSET",         normalBalance: "CREDIT", isPostable: true,  parentCode: "1400" },
  { code: "2010", name: "Accounts Payable",                     type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "2020", name: "Business Credit Card",                 type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "2050", name: "Deferred / Unearned Revenue",          type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "2060", name: "Customer Overpayments (unapplied)",     type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "2100", name: "HST Collected on Sales",               type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "2150", name: "HST Payable to CRA (filed)",           type: "LIABILITY", subType: "CURRENT_LIABILITY",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "3010", name: "Owner's Capital - Contributions",      type: "EQUITY",    subType: "OWNERS_EQUITY",       normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "3020", name: "Owner's Draws",                        type: "EQUITY",    subType: "OWNERS_EQUITY",       normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "3900", name: "Accumulated Earnings",                 type: "EQUITY",    subType: "OWNERS_EQUITY",       normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "4010", name: "Consulting Fees",                      type: "REVENUE",   subType: "OPERATING_REVENUE",   normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "5010", name: "Subcontractor Costs",                  type: "EXPENSE",   subType: "COST_OF_SERVICES",    normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "5020", name: "Project-Specific Software",            type: "EXPENSE",   subType: "COST_OF_SERVICES",    normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6010", name: "Advertising & Marketing",              type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6020", name: "Subscriptions & Internal SaaS",        type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6030", name: "Small Equipment (below cap threshold)", type: "EXPENSE",  subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6040", name: "Business-Use-of-Home",                 type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6050", name: "Professional Fees",                    type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6060", name: "Merchant & Processing Fees",           type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6065", name: "Bank Charges & Interest",              type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6070", name: "Travel",                               type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6075", name: "Meals & Entertainment (50% limited)",  type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6080", name: "General Office Supplies",              type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "6090", name: "Depreciation Expense",                 type: "EXPENSE",   subType: "OPERATING_EXPENSE",   normalBalance: "DEBIT",  isPostable: true,  parentCode: null },
  { code: "7010", name: "Interest & Other Income",              type: "REVENUE",   subType: "OTHER_INCOME",        normalBalance: "CREDIT", isPostable: true,  parentCode: null },
  { code: "7050", name: "FX Gain / (Loss)",                     type: "REVENUE",   subType: "OTHER_INCOME",        normalBalance: "CREDIT", isPostable: true,  parentCode: null },
] as const;

async function main() {
  for (const a of accounts) {
    const parent = a.parentCode
      ? await prisma.account.findUnique({ where: { code: a.parentCode } })
      : null;

    await prisma.account.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        type: a.type,
        subType: a.subType,
        normalBalance: a.normalBalance,
        isPostable: a.isPostable,
        parentId: parent ? parent.id : null,
      },
      update: {
        name: a.name,
        type: a.type,
        subType: a.subType,
        normalBalance: a.normalBalance,
        isPostable: a.isPostable,
        parentId: parent ? parent.id : null,
      },
    });

    console.log("seeded", a.code, a.name);
  }
  await seedTaxRates();
  await seedOrgProfile();
  await seedCapitalCandidates();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

async function seedTaxRates() {
  const collected = await prisma.account.findUnique({ where: { code: "2100" } });
  const recoverable = await prisma.account.findUnique({ where: { code: "1250" } });

  if (!collected || !recoverable) {
    throw new Error("HST accounts 2100 and 1250 must be seeded before tax rates.");
  }

  const rates = [
    { code: "HST_ON", name: "HST Ontario 13%", ratePercent: "13.0000" },
    { code: "ZERO_RATED", name: "Zero-rated (0%)", ratePercent: "0.0000" },
  ];

  for (const r of rates) {
    await prisma.taxRate.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        name: r.name,
        ratePercent: r.ratePercent,
        effectiveFrom: new Date("2010-07-01"),
        collectedAccountId: collected.id,
        recoverableAccountId: recoverable.id,
      },
      update: {
        name: r.name,
        ratePercent: r.ratePercent,
        collectedAccountId: collected.id,
        recoverableAccountId: recoverable.id,
      },
    });
    console.log("seeded tax rate", r.code, r.name);
  }
}

async function seedOrgProfile() {
  await prisma.orgProfile.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      legalName: "TODO - legal name",
      tradeName: null,
      email: null,
      phone: null,
      addressLine1: null,
      city: null,
      province: "ON",
      postalCode: null,
      country: "CA",
      businessNumber: null,
      hstRegisteredFrom: null,
      paymentInstructions: "TODO - e-transfer address or bank details",
      capitalizationThreshold: "500.00",
    },
    update: {},
  });

  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });
  console.log(
    `org profile: ${profile.legalName} | HST registered: ${
      profile.hstRegisteredFrom ? profile.hstRegisteredFrom.toISOString().slice(0, 10) : "no"
    } | cap threshold ${profile.capitalizationThreshold.toString()}`,
  );
}

const CAPITAL_CANDIDATE_CODES = ["6030"];

async function seedCapitalCandidates() {
  await prisma.account.updateMany({
    where: { code: { in: CAPITAL_CANDIDATE_CODES } },
    data: { capitalCandidate: true },
  });
  await prisma.account.updateMany({
    where: { code: { notIn: CAPITAL_CANDIDATE_CODES } },
    data: { capitalCandidate: false },
  });
  console.log(`capital candidates: ${CAPITAL_CANDIDATE_CODES.join(", ")}`);
}
