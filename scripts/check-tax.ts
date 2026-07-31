import { computeInvoiceTotals } from "../lib/invoicing/tax";

let passed = 0;
let failed = 0;

type Line = { amount: string; ratePercent: string };

function expectTotals(
  name: string,
  lines: Line[],
  want: { subtotal: string; tax: string; total: string; lineTax: string[] },
) {
  const r = computeInvoiceTotals(lines);
  const got = {
    subtotal: r.subtotal.toFixed(2),
    tax: r.taxTotal.toFixed(2),
    total: r.total.toFixed(2),
    lineTax: r.lineTax.map((d) => d.toFixed(2)),
  };

  const sumLines = r.lineTax.reduce((s, d) => s.plus(d), r.taxTotal.minus(r.taxTotal));
  const sumsMatch = sumLines.equals(r.taxTotal);

  const ok =
    got.subtotal === want.subtotal &&
    got.tax === want.tax &&
    got.total === want.total &&
    got.lineTax.join(",") === want.lineTax.join(",") &&
    sumsMatch;

  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        want sub ${want.subtotal} tax ${want.tax} total ${want.total} lines ${want.lineTax.join(",")}`);
    console.log(`        got  sub ${got.subtotal} tax ${got.tax} total ${got.total} lines ${got.lineTax.join(",")}`);
    if (!sumsMatch) console.log(`        line tax does not sum to taxTotal`);
  }
}

console.log("\ncomputeInvoiceTotals\n");

expectTotals(
  "rounds at the group, not per line",
  [
    { amount: "333.33", ratePercent: "13" },
    { amount: "333.33", ratePercent: "13" },
    { amount: "333.33", ratePercent: "13" },
  ],
  { subtotal: "999.99", tax: "130.00", total: "1129.99", lineTax: ["43.34", "43.33", "43.33"] },
);

expectTotals(
  "single taxed line",
  [{ amount: "8000.00", ratePercent: "13" }],
  { subtotal: "8000.00", tax: "1040.00", total: "9040.00", lineTax: ["1040.00"] },
);

expectTotals(
  "untaxed line among taxed lines",
  [
    { amount: "333.33", ratePercent: "13" },
    { amount: "500.00", ratePercent: "0" },
    { amount: "333.33", ratePercent: "13" },
    { amount: "333.33", ratePercent: "13" },
  ],
  { subtotal: "1499.99", tax: "130.00", total: "1629.99", lineTax: ["43.34", "0.00", "43.33", "43.33"] },
);

expectTotals(
  "line order does not change the result",
  [
    { amount: "1500.00", ratePercent: "0" },
    { amount: "8000.00", ratePercent: "13" },
  ],
  { subtotal: "9500.00", tax: "1040.00", total: "10540.00", lineTax: ["0.00", "1040.00"] },
);

expectTotals(
  "all zero-rated",
  [
    { amount: "1000.00", ratePercent: "0" },
    { amount: "2500.00", ratePercent: "0" },
  ],
  { subtotal: "3500.00", tax: "0.00", total: "3500.00", lineTax: ["0.00", "0.00"] },
);

expectTotals(
  "negative discount line reduces tax",
  [
    { amount: "8000.00", ratePercent: "13" },
    { amount: "-500.00", ratePercent: "13" },
  ],
  { subtotal: "7500.00", tax: "975.00", total: "8475.00", lineTax: ["1040.00", "-65.00"] },
);

expectTotals(
  "zero group base does not divide by zero",
  [
    { amount: "500.00", ratePercent: "13" },
    { amount: "-500.00", ratePercent: "13" },
    { amount: "1000.00", ratePercent: "0" },
  ],
  { subtotal: "1000.00", tax: "0.00", total: "1000.00", lineTax: ["0.00", "0.00", "0.00"] },
);

expectTotals(
  "seven lines, drift spread by largest remainder",
  [
    { amount: "14.29", ratePercent: "13" },
    { amount: "14.29", ratePercent: "13" },
    { amount: "14.29", ratePercent: "13" },
    { amount: "14.28", ratePercent: "13" },
    { amount: "14.28", ratePercent: "13" },
    { amount: "14.28", ratePercent: "13" },
    { amount: "14.29", ratePercent: "13" },
  ],
  {
    subtotal: "100.00",
    tax: "13.00",
    total: "113.00",
    lineTax: ["1.85", "1.85", "1.86", "1.86", "1.86", "1.86", "1.86"],
  },
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
