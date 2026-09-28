import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/invoicing/renderInvoicePdf";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dl = new URL(request.url).searchParams.get("download") === "1";
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true, status: true },
  });

  if (!invoice) {
    return new NextResponse("Invoice not found.", { status: 404 });
  }
  if (invoice.status === "DRAFT") {
    return new NextResponse("This invoice has not been issued, so no PDF exists.", { status: 404 });
  }

  try {
    const pdf = await renderInvoicePdf(id);
    return new NextResponse(new Uint8Array(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return new NextResponse("PDF generation failed: " + (e as Error).message, { status: 500 });
  }
}
