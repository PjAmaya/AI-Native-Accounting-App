import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";
import { renderCreditNotePdf } from "@/lib/invoicing/renderCreditNote";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const note = await prisma.creditNote.findUnique({
    where: { id },
    select: { creditNumber: true, status: true, pdfPath: true },
  });
  if (!note) return new NextResponse("Not found.", { status: 404 });

  if (note.pdfPath) {
    try {
      const bytes = await readStoredFile(note.pdfPath);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${note.creditNumber}.pdf"`,
        },
      });
    } catch {
      // Stored file missing — fall through to live render
    }
  }

  const pdf = await renderCreditNotePdf(id);
  return new NextResponse(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${note.creditNumber}.pdf"`,
    },
  });
}
