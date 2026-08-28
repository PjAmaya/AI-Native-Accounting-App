import Decimal from "decimal.js";
import { prisma } from "../db";

export type BudgetLine = {
  code: string;
  name: string;
  label: string | null;
  budget: Decimal;
  actual: Decimal;
  variance: Decimal;
  overBudget: boolean;
};

export type ProjectPerformance = {
  code: string;
  name: string;
  clientName: string | null;
  status: string;
  contractValue: Decimal | null;
  invoiced: Decimal;
  remainingToInvoice: Decimal | null;
  percentInvoiced: Decimal | null;
  budgetedCost: Decimal;
  actualCost: Decimal;
  costVariance: Decimal;
  costLines: BudgetLine[];
  collected: Decimal;
  margin: Decimal;
  marginPercent: Decimal | null;
  budgetedMargin: Decimal | null;
  budgetedMarginPercent: Decimal | null;
};

export async function projectPerformance(
  from?: Date,
  to?: Date,
): Promise<ProjectPerformance[]> {
  const projects = await prisma.project.findMany({
    include: {
      contact: true,
      budgetLines: { include: { account: true }, orderBy: { account: { code: "asc" } } },
      invoices: {
        where: { status: { in: ["ISSUED", "PAID"] } },
        include: { applications: true, creditApplications: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const lines = await prisma.journalLine.findMany({
    where: {
      projectId: { not: null },
      entry: {
        status: { in: ["POSTED", "REVERSED"] },
        ...(from || to
          ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      account: { subType: { in: ["OPERATING_REVENUE", "COST_OF_SERVICES", "OPERATING_EXPENSE"] } },
    },
    include: { account: true },
  });

  const revenueByProject = new Map<string, Decimal>();
  const costByProjectAccount = new Map<string, Map<string, { name: string; amount: Decimal }>>();

  for (const line of lines) {
    const projectId = line.projectId!;
    const debit = new Decimal(line.debit.toString());
    const credit = new Decimal(line.credit.toString());

    if (line.account.subType === "OPERATING_REVENUE") {
      revenueByProject.set(
        projectId,
        (revenueByProject.get(projectId) ?? new Decimal(0)).plus(credit).minus(debit),
      );
      continue;
    }

    const perAccount = costByProjectAccount.get(projectId) ?? new Map();
    const existing = perAccount.get(line.account.code) ?? {
      name: line.account.name,
      amount: new Decimal(0),
    };
    existing.amount = existing.amount.plus(debit).minus(credit);
    perAccount.set(line.account.code, existing);
    costByProjectAccount.set(projectId, perAccount);
  }

  return projects.map((project) => {
    const invoiced = revenueByProject.get(project.id) ?? new Decimal(0);
    const actuals = costByProjectAccount.get(project.id) ?? new Map();

    const costLines: BudgetLine[] = [];

    // Add each budget line individually (same account can appear multiple times with different labels)
    for (const bl of project.budgetLines) {
      costLines.push({
        code: bl.account.code,
        name: bl.account.name,
        label: bl.label ?? null,
        budget: new Decimal(bl.amount.toString()),
        actual: new Decimal(0),
        variance: new Decimal(bl.amount.toString()),
        overBudget: false,
      });
    }

    // Add actuals from journal lines — distribute to matching budget lines or create unbudgeted entries
    for (const [code, entry] of actuals.entries()) {
      const matching = costLines.filter((l) => l.code === code);
      if (matching.length === 0) {
        // Unbudgeted cost
        costLines.push({
          code,
          name: entry.name,
          label: null,
          budget: new Decimal(0),
          actual: entry.amount,
          variance: entry.amount.negated(),
          overBudget: true,
        });
      } else if (matching.length === 1) {
        // Single budget line for this account — all actuals go here
        matching[0].actual = entry.amount;
        matching[0].variance = matching[0].budget.minus(entry.amount);
        matching[0].overBudget = matching[0].budget.greaterThan(0) && entry.amount.greaterThan(matching[0].budget);
      } else {
        // Multiple budget lines for same account — actuals show on the first, since
        // the ledger doesn't distinguish subcontractor A from B at the GL level
        matching[0].actual = entry.amount;
        matching[0].variance = matching[0].budget.minus(entry.amount);
        matching[0].overBudget = matching[0].budget.greaterThan(0) && entry.amount.greaterThan(matching[0].budget);
      }
    }

    const budgetedCost = costLines.reduce((sum, l) => sum.plus(l.budget), new Decimal(0));
    const actualCost = costLines.reduce((sum, l) => sum.plus(l.actual), new Decimal(0));

    const contractValue = project.contractValue
      ? new Decimal(project.contractValue.toString())
      : null;

    const collected = project.invoices.reduce(
      (sum, invoice) =>
        sum.plus(
          [...invoice.applications, ...invoice.creditApplications].reduce(
            (paid, a) => paid.plus(a.amountApplied.toString()),
            new Decimal(0),
          ),
        ),
      new Decimal(0),
    );

    const margin = invoiced.minus(actualCost);
    const budgetedMargin = contractValue ? contractValue.minus(budgetedCost) : null;

    return {
      code: project.code,
      name: project.name,
      clientName: project.contact?.name ?? null,
      status: project.status,
      contractValue,
      invoiced,
      remainingToInvoice: contractValue ? contractValue.minus(invoiced) : null,
      percentInvoiced:
        contractValue && contractValue.greaterThan(0)
          ? invoiced.dividedBy(contractValue).times(100).toDecimalPlaces(1)
          : null,
      budgetedCost,
      actualCost,
      costVariance: budgetedCost.minus(actualCost),
      costLines,
      collected,
      margin,
      marginPercent: invoiced.isZero()
        ? null
        : margin.dividedBy(invoiced).times(100).toDecimalPlaces(1),
      budgetedMargin,
      budgetedMarginPercent:
        contractValue && contractValue.greaterThan(0) && budgetedMargin
          ? budgetedMargin.dividedBy(contractValue).times(100).toDecimalPlaces(1)
          : null,
    };
  });
}
