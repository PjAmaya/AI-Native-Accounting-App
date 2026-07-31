import Decimal from "decimal.js";

export type DraftLine = {
  accountCode: string;
  debit: string;
  credit: string;
  description?: string;
  contactId?: string;
  projectId?: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  totalDebits: Decimal;
  totalCredits: Decimal;
};

export function validateEntry(lines: DraftLine[]): ValidationResult {
  const errors: string[] = [];
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  if (lines.length < 2) {
    errors.push("An entry must have at least two lines.");
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const debit = new Decimal(line.debit);
    const credit = new Decimal(line.credit);

    if (debit.isNegative() || credit.isNegative()) {
      errors.push(`Line ${lineNumber}: amounts cannot be negative.`);
    }
    if (debit.isZero() && credit.isZero()) {
      errors.push(`Line ${lineNumber}: must have either a debit or a credit.`);
    }
    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      errors.push(`Line ${lineNumber}: cannot have both a debit and a credit.`);
    }

    totalDebits = totalDebits.plus(debit);
    totalCredits = totalCredits.plus(credit);
  });

  if (!totalDebits.equals(totalCredits)) {
    errors.push(
      `Entry does not balance: debits ${totalDebits.toFixed(2)}, credits ${totalCredits.toFixed(2)}.`,
    );
  }

  return { ok: errors.length === 0, errors, totalDebits, totalCredits };
}