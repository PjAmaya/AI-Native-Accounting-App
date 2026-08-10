import Decimal from "decimal.js";
import { prisma } from "../db";

export type BudgetLine = {
  code: string;
  name: string;
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

    const codes = new Set<string>([
      ...project.budgetLines.map((b) => b.account.code),
      ...actuals.keys(),
    ]);

    const costLines: BudgetLine[] = [...codes]
      .sort()
      .map((code) => {
        const budgetLine = project.budgetLines.find((b) => b.account.code === code);
        const actual = actuals.get(code)?.amount ?? new Decimal(0);
        const budget = budgetLine ? new Decimal(budgetLine.amount.toString()) : new Decimal(0);
        const variance = budget.minus(actual);
        return {
          code,
          name: budgetLine?.account.name ?? actuals.get(code)?.name ?? code,
          budget,
          actual,
          variance,
          overBudget: budget.greaterThan(0) && actual.greaterThan(budget),
        };
      })
      .filter((l) => !l.budget.isZero() || !l.actual.isZero());

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
