import Decimal from "decimal.js";
import type { TxClient } from "../ledger/txClient";

export async function syncInvoiceStatusTx(tx: TxClient, invoiceIds: string[]) {
  for (const invoiceId of Array.from(new Set(invoiceIds))) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, total: true },
    });
    if (!invoice) continue;
    if (invoice.status !== "ISSUED" && invoice.status !== "PAID") continue;

    const [payments, credits] = await Promise.all([
      tx.paymentApplication.aggregate({
        where: { invoiceId },
        _sum: { amountApplied: true },
      }),
      tx.creditApplication.aggregate({
        where: { invoiceId },
        _sum: { amountApplied: true },
      }),
    ]);
    const applied = new Decimal(payments._sum.amountApplied?.toString() ?? "0").plus(
      new Decimal(credits._sum.amountApplied?.toString() ?? "0"),
    );
    const settled = applied.greaterThanOrEqualTo(new Decimal(invoice.total.toString()));

    const next = settled ? "PAID" : "ISSUED";
    if (next !== invoice.status) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: next } });
    }
  }
}

export async function syncBillStatusTx(tx: TxClient, billIds: string[]) {
  for (const billId of Array.from(new Set(billIds))) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: { id: true, status: true, total: true },
    });
    if (!bill) continue;
    if (bill.status !== "APPROVED" && bill.status !== "PAID") continue;

    const [payments, credits] = await Promise.all([
      tx.billApplication.aggregate({
        where: { billId },
        _sum: { amountApplied: true },
      }),
      tx.supplierCreditApplication.aggregate({
        where: { billId },
        _sum: { amountApplied: true },
      }),
    ]);
    const applied = new Decimal(payments._sum.amountApplied?.toString() ?? "0").plus(
      new Decimal(credits._sum.amountApplied?.toString() ?? "0"),
    );
    const settled = applied.greaterThanOrEqualTo(new Decimal(bill.total.toString()));

    const next = settled ? "PAID" : "APPROVED";
    if (next !== bill.status) {
      await tx.bill.update({ where: { id: billId }, data: { status: next } });
    }
  }
}
