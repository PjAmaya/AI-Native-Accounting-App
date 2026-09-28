import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ViewCreditNotePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await prisma.creditNote.findUnique({
    where: { id },
    select: { creditNumber: true, status: true },
  });
  if (!note || note.status === "DRAFT") notFound();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-surface px-5 py-3">
        <Link
          href={`/credit-notes/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          {note.creditNumber}
        </Link>
        
          <a
          download={`${note.creditNumber}.pdf`}
          className="ml-auto rounded-lg border border-rule px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-wash/50"
        >
          Download
        </a>
      </div>
      <iframe
        src={`/credit-notes/${id}/pdf`}
        className="flex-1 w-full border-0"
        title={`${note.creditNumber} PDF`}
      />
    </div>
  );
}
