import Link from "next/link";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PaymentForm, type PaymentFormOptions, type OpenDoc } from "@/components/form/PaymentForm";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; bill?: string }>;
}) {
  const { invoice: presetInvoiceId, bill: presetBillId } = await searchParams;
  const [customers, vendors, cashParent, invoices, bills] = await Promise.all([
    prisma.contact.findMany({ where: { isCustomer: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { isVendor: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.account.findUnique({ where: { code: "1000" } }),
    prisma.invoice.findMany({
      where: { status: "ISSUED" },
      include: { applications: true, creditApplications: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.bill.findMany({
      where: { status: "APPROVED" },
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

  const openDocs: OpenDoc[] = [];

  for (const invoice of invoices) {
    const applied = [...invoice.applications, ...invoice.creditApplications].reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding = new Decimal(invoice.total.toString()).minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    openDocs.push({
      kind: "INVOICE",
      key: invoice.invoiceNumber,
      label: invoice.invoiceNumber,
      contactId: invoice.contactId,
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      total: invoice.total.toString(),
      outstanding: outstanding.toFixed(2),
    });
  }

  for (const bill of bills) {
    const applied = bill.applications.reduce(
      (sum, a) => sum.plus(a.amountApplied.toString()),
      new Decimal(0),
    );
    const outstanding = new Decimal(bill.total.toString()).minus(applied);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    openDocs.push({
      kind: "BILL",
      key: String(bill.billNumber),
      label: `#${bill.billNumber} · ${bill.supplierInvoiceNumber}`,
      contactId: bill.contactId,
      dueDate: bill.dueDate.toISOString().slice(0, 10),
      total: bill.total.toString(),
      outstanding: outstanding.toFixed(2),
    });
  }

  const presetInvoice = presetInvoiceId
    ? invoices.find((i) => i.id === presetInvoiceId)
    : undefined;
  const presetBill = presetBillId ? bills.find((b) => b.id === presetBillId) : undefined;

  const presetDoc = presetInvoice
    ? openDocs.find((d) => d.kind === "INVOICE" && d.key === presetInvoice.invoiceNumber)
    : presetBill
      ? openDocs.find((d) => d.kind === "BILL" && d.key === String(presetBill.billNumber))
      : undefined;

  const options: PaymentFormOptions = {
    presetDirection: presetBill ? "SENT" : presetInvoice ? "RECEIVED" : undefined,
    presetContactId: presetInvoice?.contactId ?? presetBill?.contactId,
    presetApplied: presetDoc ? { [presetDoc.key]: presetDoc.outstanding } : undefined,
    presetAmount: presetDoc?.outstanding,
    customers: customers.map((c) => ({ value: c.id, label: c.name })),
    vendors: vendors.map((v) => ({ value: v.id, label: v.name })),
    bankAccounts: bankAccounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` })),
    openDocs,
    defaultDate: new Date().toISOString().slice(0, 10),
  };

  return (
    <div>
      <Link href="/payments" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Payments
      </Link>
      <h1 className="page-title mt-3">Record a payment</h1>
      <div className="mt-7">
        <PaymentForm options={options} />
      </div>
    </div>
  );
}
