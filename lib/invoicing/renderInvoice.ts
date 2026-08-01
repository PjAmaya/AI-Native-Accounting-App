import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import Decimal from "decimal.js";
import { prisma } from "../db";
import { InvoiceDocument, type InvoiceDocumentData } from "./InvoiceDocument";

const DEFAULT_LOGO_PATH = "assets/logo.png";

function money(value: unknown, currency: string) {
  const amount = new Decimal(String(value));
  const formatted = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount.toNumber());
  return currency === "CAD" ? `$${formatted}` : `${formatted} ${currency}`;
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function quantity(value: unknown | null) {
  if (value === null || value === undefined) return null;
  return new Decimal(String(value)).toDecimalPlaces(2).toString();
}

async function logoDataUri(logoPath: string | null) {
  const relative = logoPath ?? DEFAULT_LOGO_PATH;
  try {
    const file = await readFile(path.join(process.cwd(), relative));
    const extension = path.extname(relative).toLowerCase();
    const mime = extension === ".svg" ? "image/svg+xml" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildInvoiceDocumentData(invoiceId: string): Promise<InvoiceDocumentData> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      contact: true,
      project: true,
      lines: { include: { taxRate: true, project: true }, orderBy: { lineNumber: "asc" } },
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} does not exist.`);

  const org = await prisma.orgProfile.findUnique({ where: { id: "default" } });
  if (!org) throw new Error("Org profile has not been seeded.");

  const isRegistered =
    org.hstRegisteredFrom !== null && invoice.invoiceDate >= org.hstRegisteredFrom;

  const projects = await prisma.project.findMany();
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const invoiceLineProjects = await prisma.journalLine.findMany({
    where: { entryId: invoice.journalEntryId ?? "" },
    select: { projectId: true },
  });
  const distinctProjectIds = [
    ...new Set(invoiceLineProjects.map((l) => l.projectId).filter((id): id is string => Boolean(id))),
  ];

  const showProjectColumn = distinctProjectIds.length > 1;
  const showQuantityColumns = invoice.lines.some((l) => l.quantity !== null || l.unitRate !== null);

  const headerProjectName = showProjectColumn
    ? "Multiple - see line items"
    : invoice.project
      ? invoice.project.name
      : distinctProjectIds.length === 1
        ? (projectById.get(distinctProjectIds[0])?.name ?? null)
        : null;

  const ratesUsed = new Map<string, string>();
  invoice.lines.forEach((line) => {
    if (line.taxRate && new Decimal(line.taxAmount.toString()).greaterThan(0)) {
      ratesUsed.set(line.taxRate.code, line.taxRate.name);
    }
  });

  const taxTotal = new Decimal(invoice.taxTotal.toString());
  const showTax = isRegistered && taxTotal.greaterThan(0);
  const taxLabel = !showTax
    ? null
    : ratesUsed.size === 1
      ? `${[...ratesUsed.values()][0]}:`
      : "Sales tax:";

  const servicePeriod =
    invoice.servicePeriodStart && invoice.servicePeriodEnd
      ? `${longDate(invoice.servicePeriodStart)} - ${longDate(invoice.servicePeriodEnd)}`
      : invoice.servicePeriodEnd
        ? longDate(invoice.servicePeriodEnd)
        : null;

  const termsDays = invoice.contact.paymentTermsDays;

  const orgAddress = [
    org.addressLine1,
    org.addressLine2,
    [org.city, org.province, org.postalCode].filter(Boolean).join(" "),
  ].filter((line): line is string => Boolean(line && line.trim()));

  const clientAddress = [
    invoice.contact.addressLine1,
    invoice.contact.addressLine2,
    [invoice.contact.city, invoice.contact.province, invoice.contact.postalCode]
      .filter(Boolean)
      .join(" "),
  ].filter((line): line is string => Boolean(line && line.trim()));

  return {
    org: {
      displayName: org.tradeName ?? org.legalName,
      legalName: org.legalName,
      addressLines: orgAddress,
      email: org.email,
      businessNumber: org.businessNumber,
      hstNumber: isRegistered ? org.businessNumber : null,
      paymentInstructions: org.paymentInstructions,
      invoiceFooter: org.invoiceFooter,
      logoDataUri: await logoDataUri(org.logoPath),
    },
    client: {
      name: invoice.contact.name,
      addressLines: clientAddress,
      phone: invoice.contact.phone,
      email: invoice.contact.email,
    },
    invoice: {
      number: invoice.invoiceNumber,
      date: longDate(invoice.invoiceDate),
      dueDate: longDate(invoice.dueDate),
      currency: invoice.currency,
      clientReference: invoice.clientReference,
      servicePeriod,
      projectName: headerProjectName,
      termsLine: `Net ${termsDays} days`,
      notes: invoice.notes,
    },
    lines: invoice.lines.map((line) => ({
      description: line.description,
      quantity: quantity(line.quantity),
      unitRate: line.unitRate === null ? null : money(line.unitRate, invoice.currency),
      amount: money(line.amount, invoice.currency),
      projectCode: line.project ? line.project.code : null,
    })),
    showProjectColumn,
    showQuantityColumns,
    totals: {
      subtotal: money(invoice.subtotal, invoice.currency),
      taxLabel,
      taxTotal: showTax ? money(invoice.taxTotal, invoice.currency) : null,
      total: money(invoice.total, invoice.currency),
    },
  };
}

export async function renderInvoiceHtml(invoiceId: string) {
  const data = await buildInvoiceDocumentData(invoiceId);
  const markup = renderToStaticMarkup(React.createElement(InvoiceDocument, { data }));
  return `<!DOCTYPE html>${markup}`;
}
