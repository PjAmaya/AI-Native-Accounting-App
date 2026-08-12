import { prisma } from "../db";
import { postDraftTx, type TxClient } from "../ledger/post";
import { renderInvoicePdf } from "./renderInvoicePdf";
import { syncInvoicePdfToDrive } from "../google/driveSync";
import { storeFile } from "../storage";

function assertIssuable(invoice: {
  invoiceNumber: string;
  status: string;
  journalEntryId: string | null;
  lines: unknown[];
}) {
  if (invoice.status === "ISSUED") throw new Error(`Invoice ${invoice.invoiceNumber} is already issued.`);
  if (invoice.status === "PAID") throw new Error(`Invoice ${invoice.invoiceNumber} is already paid.`);
  if (invoice.status === "VOID") throw new Error(`Invoice ${invoice.invoiceNumber} is void.`);
  if (!invoice.journalEntryId) {
    throw new Error(`Invoice ${invoice.invoiceNumber} has no journal entry and cannot be issued.`);
  }
  if (invoice.lines.length === 0) {
    throw new Error(`Invoice ${invoice.invoiceNumber} has no lines.`);
  }
}

export async function issueInvoiceTx(
  tx: TxClient,
  invoiceId: string,
  pdf?: { path: string; sha256: string },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, contact: true },
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} does not exist.`);
  assertIssuable(invoice);

  const entry = await postDraftTx(tx, invoice.journalEntryId!);

  const arDebit = entry.lines.reduce(
    (sum, line) => sum.plus(line.debit),
    entry.lines[0].debit.minus(entry.lines[0].debit),
  );
  if (!arDebit.equals(invoice.total)) {
    throw new Error(
      `Invoice ${invoice.invoiceNumber} total ${invoice.total.toString()} does not match its journal entry total ${arDebit.toString()}.`,
    );
  }

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      pdfPath: pdf?.path ?? null,
      pdfHash: pdf?.sha256 ?? null,
    },
    include: { lines: true, contact: true, journalEntry: { include: { lines: true } } },
  });
}

export async function issueInvoice(invoiceId: string, options?: { skipPdf?: boolean }) {
  const preflight = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!preflight) throw new Error(`Invoice ${invoiceId} does not exist.`);
  assertIssuable(preflight);

  let pdf: { path: string; sha256: string } | undefined;

  if (!options?.skipPdf) {
    const rendered = await renderInvoicePdf(invoiceId);
    const year = preflight.invoiceDate.getUTCFullYear();
    const stored = await storeFile(
      `invoices/${year}/${preflight.invoiceNumber}.pdf`,
      rendered.bytes,
    );
    pdf = { path: stored.path, sha256: stored.sha256 };
  }

  const result = await prisma.$transaction((tx) => issueInvoiceTx(tx, invoiceId, pdf));

  try {
    await syncInvoicePdfToDrive(invoiceId);
  } catch {
    // Local PDF is authoritative; Drive sync failure is non-blocking
  }

  return result;
}
