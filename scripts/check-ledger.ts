import { validateEntry } from "../lib/ledger/balance.ts";

let passed = 0;
let failed = 0;

function expect(name: string, actual: boolean, shouldBe: boolean) {
  if (actual === shouldBe) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} — expected ok=${shouldBe}, got ok=${actual}`);
  }
}

console.log("\nvalidateEntry\n");

expect(
  "accepts a balanced two-line entry",
  validateEntry([
    { accountCode: "1200", debit: "8000.00", credit: "0" },
    { accountCode: "4010", debit: "0", credit: "8000.00" },
  ]).ok,
  true,
);

expect(
  "rejects an entry that is off by one cent",
  validateEntry([
    { accountCode: "1200", debit: "8000.00", credit: "0" },
    { accountCode: "4010", debit: "0", credit: "7999.99" },
  ]).ok,
  false,
);

expect(
  "rejects a line with both a debit and a credit",
  validateEntry([
    { accountCode: "1200", debit: "100", credit: "100" },
    { accountCode: "4010", debit: "0", credit: "100" },
  ]).ok,
  false,
);

expect(
  "rejects a negative amount",
  validateEntry([
    { accountCode: "1200", debit: "-100", credit: "0" },
    { accountCode: "4010", debit: "0", credit: "-100" },
  ]).ok,
  false,
);

expect(
  "rejects a single-line entry",
  validateEntry([{ accountCode: "1200", debit: "100", credit: "0" }]).ok,
  false,
);

expect(
  "handles fractional cents exactly (0.10 + 0.20 = 0.30)",
  validateEntry([
    { accountCode: "1200", debit: "0.10", credit: "0" },
    { accountCode: "1210", debit: "0.20", credit: "0" },
    { accountCode: "4010", debit: "0", credit: "0.30" },
  ]).ok,
  true,
);

expect(
  "accepts a multi-line entry with tax",
  validateEntry([
    { accountCode: "1200", debit: "9040.00", credit: "0" },
    { accountCode: "4010", debit: "0", credit: "8000.00" },
    { accountCode: "2100", debit: "0", credit: "1040.00" },
  ]).ok,
  true,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
