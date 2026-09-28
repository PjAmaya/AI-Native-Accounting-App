import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewInvoicePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true, status: true },
  });
  if (!invoice || invoice.status === "DRAFT") notFound();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center gap-3 border-b border-rule bg-surface px-5 py-3">
        <Link
          href={`/invoices/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          {invoice.invoiceNumber}
        </Link>
        
          <a
          download={`${invoice.invoiceNumber}.pdf`}
          className="ml-auto rounded-lg border border-rule px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-wash/50"
        >
          Download
        </a>
      </div>
      <iframe
        src={`/invoices/${id}/pdf?download=1`}
        className="flex-1 w-full border-0"
        title={`${invoice.invoiceNumber} PDF`}
      />
    </div>
  );
}
