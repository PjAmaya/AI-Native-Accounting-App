import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { PaymentForm, type PaymentFormOptions, type OpenDoc, type PaymentValues } from "@/components/form/PaymentForm";
import { deletePaymentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      bankAccount: true,
      journalEntry: true,
      applications: { include: { invoice: true } },
      billApplications: { include: { bill: true } },
    },
  });
  if (!payment) notFound();
  if (payment.journalEntry && payment.journalEntry.status !== "DRAFT") {
    redirect("/payments");
  }

  const [customers, vendors, cashParent, invoices, bills] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { isVendor: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.account.findUnique({ where: { code: "1000" } }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PAID"] } },
      include: { applications: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.bill.findMany({
      where: { status: { in: ["APPROVED", "PAID"] } },
      include: { applications: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const bankAccounts = cashParent
    ? await prisma.account.findMany({
        where: { parentId: cashParent.id, isActive: true, isPostable: true },
        orderBy: { code: "asc" },
      })
    : [];

  const ownInvoice = new Map(
    payment.applications.map((a) => [a.invoice.invoiceNumber, a.amountApplied.toString()]),
  );
  const ownBill = new Map(
    payment.billApplications.map((a) => [String(a.bill.billNumber), a.amountApplied.toString()]),
  );

  const openDocs: OpenDoc[] = [];

  for (const invoice of invoices) {
    const others = invoice.applications
      .filter((a) => a.paymentId !== payment.id)
      .reduce((sum, a) => sum.plus(a.amountApplied.toString()), new Decimal(0));
    const available = new Decimal(invoice.total.toString()).minus(others);
    const mine = ownInvoice.get(invoice.invoiceNumber);
    if (available.lessThanOrEqualTo(0) && !mine) continue;
    openDocs.push({
      kind: "INVOICE",
      key: invoice.invoiceNumber,
      label: invoice.invoiceNumber,
      contactId: invoice.contactId,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      total: invoice.total.toString(),
      outstanding: available.toFixed(2),
    });
  }

  for (const bill of bills) {
    const others = bill.applications
      .filter((a) => a.paymentId !== payment.id)
      .reduce((sum, a) => sum.plus(a.amountApplied.toString()), new Decimal(0));
    const available = new Decimal(bill.total.toString()).minus(others);
    const mine = ownBill.get(String(bill.billNumber));
    if (available.lessThanOrEqualTo(0) && !mine) continue;
    openDocs.push({
      kind: "BILL",
      key: String(bill.billNumber),
      label: `#${bill.billNumber} · ${bill.supplierInvoiceNumber}`,
      contactId: bill.contactId,
      dueDate: bill.dueDate.toISOString().slice(0, 10),
      total: bill.total.toString(),
      outstanding: available.toFixed(2),
    });
  }

  const options: PaymentFormOptions = {
    customers: customers.map((c) => ({ value: c.id, label: c.name })),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    bankAccounts: bankAccounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
    openDocs,
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  const values: PaymentValues = {
    id: payment.id,
    direction: payment.direction,
    contactId: payment.contactId,
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    amount: payment.amount.toString(),
    bankAccountCode: payment.bankAccount.code,
    method: payment.method ?? "",
    reference: payment.reference ?? "",
    notes: payment.notes ?? "",
    applied: Object.fromEntries([...ownInvoice, ...ownBill]),
  };

  const remove = deletePaymentAction.bind(null, payment.id);

  return (
    <div>
      <Link href="/payments" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Payments
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title font-mono">Payment #{payment.paymentNumber}</h1>
          <p className="mt-2 text-[14px] text-muted">
            Draft — not yet posted to the ledger.
          </p>
        </div>
        <form action={remove} className="shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden />
            Delete
          </button>
        </form>
      </div>

      <div className="mt-7">
        <PaymentForm options={options} values={values} />
      </div>
    </div>
  );
}
