import Decimal from "decimal.js";

export type TaxableLine = {
  amount: string;
  ratePercent: string;
};

export type InvoiceTotals = {
  subtotal: Decimal;
  taxTotal: Decimal;
  total: Decimal;
  lineTax: Decimal[];
};

const CENTS = 2;

function toCents(value: Decimal): Decimal {
  return value.toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
}

export function computeInvoiceTotals(lines: TaxableLine[]): InvoiceTotals {
  const amounts = lines.map((l) => new Decimal(l.amount));
  const subtotal = amounts.reduce((sum, a) => sum.plus(a), new Decimal(0));

  const groups = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const key = new Decimal(line.ratePercent).toString();
    const existing = groups.get(key);
    if (existing) existing.push(index);
    else groups.set(key, [index]);
  });

  const lineTax: Decimal[] = amounts.map(() => new Decimal(0));
  let taxTotal = new Decimal(0);

  for (const [rateKey, indexes] of groups) {
    const rate = new Decimal(rateKey);
    const base = indexes.reduce((sum, i) => sum.plus(amounts[i]), new Decimal(0));
    const groupTax = toCents(base.times(rate).dividedBy(100));
    taxTotal = taxTotal.plus(groupTax);

    if (base.isZero()) continue;

    const provisional = indexes.map((i) => toCents(groupTax.times(amounts[i]).dividedBy(base)));
    const allocated = provisional.reduce((sum, p) => sum.plus(p), new Decimal(0));
    let drift = groupTax.minus(allocated);

    const order = indexes
      .map((idx, pos) => ({
        pos,
        remainder: groupTax.times(amounts[idx]).dividedBy(base).minus(provisional[pos]),
      }))
      .sort((a, b) => b.remainder.comparedTo(a.remainder));

    const step = drift.isNegative() ? new Decimal("-0.01") : new Decimal("0.01");
    let cursor = 0;
    while (!drift.isZero() && order.length > 0) {
      const target = order[cursor % order.length];
      provisional[target.pos] = provisional[target.pos].plus(step);
      drift = drift.minus(step);
      cursor++;
    }

    indexes.forEach((lineIndex, pos) => {
      lineTax[lineIndex] = provisional[pos];
    });
  }

  return { subtotal, taxTotal, total: subtotal.plus(taxTotal), lineTax };
}
