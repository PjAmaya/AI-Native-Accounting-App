import Decimal from "decimal.js";

export type ApplicationCheck = {
  label: string;
  total: Decimal;
  alreadyApplied: Decimal;
  requested: Decimal;
};

export function outstandingOf(total: Decimal, alreadyApplied: Decimal): Decimal {
  return total.minus(alreadyApplied);
}

export function assertNotOverApplied(check: ApplicationCheck): Decimal {
  if (check.requested.lessThanOrEqualTo(0)) {
    throw new Error(`Applied amount for ${check.label} must be greater than zero.`);
  }

  const outstanding = outstandingOf(check.total, check.alreadyApplied);

  if (check.requested.greaterThan(outstanding)) {
    throw new Error(
      `Cannot apply ${check.requested.toFixed(2)} to ${check.label} - only ${outstanding.toFixed(2)} is outstanding.`,
    );
  }

  return outstanding;
}

export function sumApplied(applications: { amountApplied: unknown }[]): Decimal {
  return applications.reduce(
    (sum, a) => sum.plus(new Decimal(String(a.amountApplied))),
    new Decimal(0),
  );
}
