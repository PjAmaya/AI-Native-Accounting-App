import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { invoiceNumber: true, pdfPath: true },
  });

  if (!invoice) {
    return new NextResponse("Invoice not found.", { status: 404 });
  }
  if (!invoice.pdfPath) {
    return new NextResponse("This invoice has not been issued, so no PDF exists.", {
      status: 404,
    });
  }

  try {
    const bytes = await readStoredFile(invoice.pdfPath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("The stored PDF is missing.", { status: 410 });
  }
}
