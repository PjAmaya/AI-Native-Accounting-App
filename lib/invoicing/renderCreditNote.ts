import React from "react";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CreditNoteDocument, type CreditNoteDocumentData } from "./CreditNoteDocument";
import { htmlToPdf } from "./renderInvoicePdf";

async function logoDataUri(logoPath: string | null) {
  if (!logoPath) return null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", logoPath));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function longDate(date: Date) {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export async function buildCreditNoteData(creditNoteId: string): Promise<CreditNoteDocumentData> {
  const note = await prisma.creditNote.findUniqueOrThrow({
    where: { id: creditNoteId },
    include: {
      contact: true,
      originalInvoice: true,
      lines: { include: { revenueAccount: true }, orderBy: { lineNumber: "asc" } },
    },
  });

  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });

  const logo = await logoDataUri("logo.png");

  const orgAddress = [
    profile.addressLine1, profile.addressLine2,
    [profile.city, profile.province, profile.postalCode].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  const clientAddress = [
    note.contact.addressLine1, note.contact.addressLine2,
    [note.contact.city, note.contact.province, note.contact.postalCode].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  const taxTotal = note.taxTotal.toString();

  return {
    org: {
      displayName: profile.tradeName ?? profile.legalName,
      legalName: profile.legalName,
      addressLines: orgAddress,
      email: profile.email,
      businessNumber: profile.businessNumber,
      hstNumber: profile.businessNumber && profile.hstRegisteredFrom ? profile.businessNumber + " RT0001" : null,
      logoDataUri: logo,
    },
    client: {
      name: note.contact.name,
      addressLines: clientAddress,
      email: note.contact.email,
    },
    creditNote: {
      number: note.creditNumber,
      date: longDate(note.creditDate),
      originalInvoiceNumber: note.originalInvoice?.invoiceNumber ?? null,
      reason: note.reason,
      currency: note.currency,
      notes: note.notes,
    },
    lines: note.lines.map((l) => ({
      description: l.description,
      amount: l.amount.toString(),
    })),
    totals: {
      subtotal: note.subtotal.toString(),
      taxTotal: Number(taxTotal) > 0 ? taxTotal : null,
      total: note.total.toString(),
    },
  };
}

export async function renderCreditNoteHtml(creditNoteId: string) {
  const data = await buildCreditNoteData(creditNoteId);
  const { renderToStaticMarkup } = await import("react-dom/server");
  return "<!DOCTYPE html>" + renderToStaticMarkup(React.createElement(CreditNoteDocument, { data }));
}

export async function renderCreditNotePdf(creditNoteId: string) {
  const html = await renderCreditNoteHtml(creditNoteId);
  return htmlToPdf(html);
}
