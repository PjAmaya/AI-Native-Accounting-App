import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { money, shortDate } from "@/lib/format";
import { sumApplied } from "@/lib/invoicing/applications";
import { unappliedOf } from "@/lib/invoicing/applyPayment";
import { ApplyPaymentForm } from "@/components/form/ApplyPaymentForm";
import type { OpenDoc } from "@/components/form/PaymentForm";
import { applyPaymentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ApplyPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      contact: true,
      journalEntry: true,
      applications: { include: { invoice: true } },
      billApplications: { include: { bill: true } },
    },
  });
  if (!payment) notFound();
  if (!payment.journalEntry || payment.journalEntry.status === "DRAFT") {
    redirect(`/payments/${payment.id}/edit`);
  }

  const unapplied = unappliedOf(payment);
  if (unapplied.lessThanOrEqualTo(0) || payment.journalEntry.status !== "POSTED") {
    redirect("/payments");
  }

  const alreadyInvoices = new Set(payment.applications.map((a) => a.invoiceId));
  const alreadyBills = new Set(payment.billApplications.map((a) => a.billId));
  const docs: OpenDoc[] = [];

  if (payment.direction === "RECEIVED") {
    const invoices = await prisma.invoice.findMany({
      where: { contactId: payment.contactId, status: "ISSUED" },
      include: { applications: true, creditApplications: true },
      orderBy: { dueDate: "asc" },
    });
    for (const invoice of invoices) {
      if (alreadyInvoices.has(invoice.id)) continue;
      const outstanding = new Decimal(invoice.total.toString())
        .minus(sumApplied(invoice.applications))
        .minus(sumApplied(invoice.creditApplications));
      if (outstanding.lessThanOrEqualTo(0)) continue;
      docs.push({
        kind: "INVOICE",
        key: invoice.invoiceNumber,
        label: invoice.invoiceNumber,
        contactId: invoice.contactId,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        total: invoice.total.toString(),
        outstanding: outstanding.toFixed(2),
      });
    }
  } else {
    const bills = await prisma.bill.findMany({
      where: { contactId: payment.contactId, status: "APPROVED" },
      include: { applications: true, supplierCreditApplications: true },
      orderBy: { dueDate: "asc" },
    });
    for (const bill of bills) {
      if (alreadyBills.has(bill.id)) continue;
      const outstanding = new Decimal(bill.total.toString())
        .minus(sumApplied(bill.applications))
        .minus(sumApplied(bill.supplierCreditApplications));
      if (outstanding.lessThanOrEqualTo(0)) continue;
      docs.push({
        kind: "BILL",
        key: String(bill.billNumber),
        label: `#${bill.billNumber} · ${bill.supplierInvoiceNumber}`,
        contactId: bill.contactId,
        dueDate: bill.dueDate.toISOString().slice(0, 10),
        total: bill.total.toString(),
        outstanding: outstanding.toFixed(2),
      });
    }
  }

  const paymentDate = payment.paymentDate.toISOString().slice(0, 10);
  const appliedTo = [
    ...payment.applications.map((a) => a.invoice.invoiceNumber),
    ...payment.billApplications.map((a) => `bill #${a.bill.billNumber}`),
  ];

  return (
    <div>
      <Link href="/payments" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Payments
      </Link>

      <h1 className="page-title mt-3">
        Apply payment <span className="font-mono">#{payment.paymentNumber}</span>
      </h1>
      <p className="mt-2 text-[14px] text-muted">
        {money(payment.amount)} {payment.direction === "RECEIVED" ? "from" : "to"} {payment.contact.name} on{" "}
        {shortDate(payment.paymentDate)}
        {appliedTo.length > 0 ? ` · already applied to ${appliedTo.join(", ")}` : ""} ·{" "}
        <span className="text-warn">{money(unapplied)} unapplied</span>
      </p>

      <div className="mt-7">
        <ApplyPaymentForm
          action={applyPaymentAction.bind(null, payment.id)}
          docs={docs}
          unapplied={unapplied.toFixed(2)}
          direction={payment.direction}
          minDate={paymentDate}
          defaultDate={paymentDate}
        />
      </div>
    </div>
  );
}
