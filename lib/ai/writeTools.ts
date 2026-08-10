import Decimal from "decimal.js";
import { prisma } from "../db";
import { createInvoice, type InvoiceDraftLine } from "../invoicing/createInvoice";
import { createBill, type BillDraftLine } from "../invoicing/createBill";
import { buildDedupeKey } from "../dedupe";
import type { ToolDefinition } from "./tools";

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function bool(args: Record<string, unknown>, key: string) {
  return args[key] === true || args[key] === "true";
}

function utcDate(value: string | null) {
  if (!value) return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function resolveContact(name: string, role: "customer" | "vendor") {
  const matches = await prisma.contact.findMany({
    where: {
      isActive: true,
      name: { contains: name, mode: "insensitive" },
      ...(role === "customer" ? { isCustomer: true } : { isVendor: true }),
    },
  });

  if (matches.length === 0) {
    throw new Error(
      `No active ${role} matches "${name}". Use list_contacts to see who exists, or create them first.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `"${name}" matches ${matches.length} ${role}s: ${matches.map((m) => m.name).join(", ")}. Be more specific.`,
    );
  }
  return matches[0];
}

const LINE_SCHEMA = {
  type: "array",
  description: "One entry per line",
  items: {
    type: "object",
    properties: {
      description: { type: "string" },
      quantity: { type: "string", description: "Defaults to 1" },
      unitRate: { type: "string", description: "Price per unit" },
      accountCode: { type: "string", description: "Four-digit account code" },
      projectCode: { type: "string" },
      taxRateCode: { type: "string", description: "Omit when no tax applies" },
    },
    required: ["description"],
  },
};

export const WRITE_TOOLS: ToolDefinition[] = [
  {
    name: "list_contacts",
    description: "Clients and vendors on file, with their role and payment terms.",
    parameters: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["customer", "vendor", "any"] },
        search: { type: "string" },
      },
    },
    handler: async (args) => {
      const role = str(args, "role");
      const search = str(args, "search");
      const contacts = await prisma.contact.findMany({
        where: {
          isActive: true,
          ...(role === "customer" ? { isCustomer: true } : {}),
          ...(role === "vendor" ? { isVendor: true } : {}),
          ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        },
        orderBy: { name: "asc" },
        take: 100,
      });
      return contacts.map((c) => ({
        name: c.name,
        isCustomer: c.isCustomer,
        isVendor: c.isVendor,
        paymentTermsDays: c.paymentTermsDays,
        city: c.city,
        email: c.email,
      }));
    },
  },
  {
    name: "list_projects",
    description: "Projects with their code, client and whether they are active.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
      const projects = await prisma.project.findMany({
        include: { contact: true },
        orderBy: { code: "asc" },
      });
      return projects.map((p) => ({
        code: p.code,
        name: p.name,
        client: p.contact?.name ?? null,
        status: p.status,
        contractValue: p.contractValue?.toString() ?? null,
      }));
    },
  },
  {
    name: "create_invoice_draft",
    description:
      "Create a DRAFT invoice. It is not issued, posts nothing, and appears in no report until the " +
      "user issues it from the invoice page. Confirm the client and amounts in your reply and give " +
      "the user the link. Use list_contacts and list_accounts first if you are unsure of a name or code.",
    parameters: {
      type: "object",
      properties: {
        clientName: { type: "string", description: "Client name, matched case-insensitively" },
        invoiceDate: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        dueDate: { type: "string", description: "Omit to use the client's payment terms" },
        servicePeriodStart: { type: "string" },
        servicePeriodEnd: { type: "string" },
        clientReference: { type: "string", description: "Their PO number" },
        notes: { type: "string" },
        lines: LINE_SCHEMA,
      },
      required: ["clientName", "lines"],
    },
    handler: async (args) => {
      const clientName = str(args, "clientName");
      if (!clientName) throw new Error("clientName is required.");
      const contact = await resolveContact(clientName, "customer");

      const rawLines = Array.isArray(args.lines) ? args.lines : [];
      if (rawLines.length === 0) throw new Error("At least one line is required.");

      const lines: InvoiceDraftLine[] = rawLines.map((raw, index) => {
        const line = raw as Record<string, unknown>;
        const description = str(line, "description");
        if (!description) throw new Error(`Line ${index + 1} needs a description.`);

        const quantity = str(line, "quantity") ?? "1";
        const unitRate = str(line, "unitRate");
        if (!unitRate) throw new Error(`Line ${index + 1} needs a unitRate.`);

        const amount = new Decimal(quantity)
          .times(unitRate)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        return {
          description,
          amount: amount.toFixed(2),
          quantity,
          unitRate,
          revenueAccountCode: str(line, "accountCode") ?? "4010",
          projectCode: str(line, "projectCode") ?? undefined,
          taxRateCode: str(line, "taxRateCode") ?? undefined,
        };
      });

      const { invoice } = await createInvoice({
        contactId: contact.id,
        invoiceDate: utcDate(str(args, "invoiceDate")),
        dueDate: str(args, "dueDate") ? utcDate(str(args, "dueDate")) : undefined,
        servicePeriodStart: str(args, "servicePeriodStart")
          ? utcDate(str(args, "servicePeriodStart"))
          : undefined,
        servicePeriodEnd: str(args, "servicePeriodEnd")
          ? utcDate(str(args, "servicePeriodEnd"))
          : undefined,
        clientReference: str(args, "clientReference") ?? undefined,
        notes: str(args, "notes") ?? undefined,
        lines,
      });

      return {
        created: "invoice draft",
        invoiceNumber: invoice.invoiceNumber,
        client: contact.name,
        subtotal: invoice.subtotal.toString(),
        taxTotal: invoice.taxTotal.toString(),
        total: invoice.total.toString(),
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        status: "DRAFT",
        link: `/invoices/${invoice.id}`,
        note: "Nothing has been posted. The user must issue it from that page.",
      };
    },
  },
  {
    name: "create_bill_draft",
    description:
      "Record a DRAFT supplier bill. It is not approved, posts nothing, and appears in no report " +
      "until the user approves it. Amounts are the vendor's — enter them exactly as their invoice states.",
    parameters: {
      type: "object",
      properties: {
        vendorName: { type: "string" },
        supplierInvoiceNumber: { type: "string", description: "Their invoice number, not ours" },
        billDate: { type: "string" },
        dueDate: { type: "string" },
        taxTotal: { type: "string", description: "Tax as stated on their invoice" },
        notes: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              amount: { type: "string" },
              accountCode: { type: "string" },
              projectCode: { type: "string" },
              taxRateCode: { type: "string" },
            },
            required: ["description", "amount", "accountCode"],
          },
        },
      },
      required: ["vendorName", "supplierInvoiceNumber", "lines"],
    },
    handler: async (args) => {
      const vendorName = str(args, "vendorName");
      const supplierInvoiceNumber = str(args, "supplierInvoiceNumber");
      if (!vendorName) throw new Error("vendorName is required.");
      if (!supplierInvoiceNumber) throw new Error("supplierInvoiceNumber is required.");

      const contact = await resolveContact(vendorName, "vendor");

      const rawLines = Array.isArray(args.lines) ? args.lines : [];
      if (rawLines.length === 0) throw new Error("At least one line is required.");

      const lines: BillDraftLine[] = rawLines.map((raw, index) => {
        const line = raw as Record<string, unknown>;
        const description = str(line, "description");
        const amount = str(line, "amount");
        const accountCode = str(line, "accountCode");
        if (!description) throw new Error(`Line ${index + 1} needs a description.`);
        if (!amount) throw new Error(`Line ${index + 1} needs an amount.`);
        if (!accountCode) throw new Error(`Line ${index + 1} needs an accountCode.`);

        return {
          description,
          amount: new Decimal(amount).toFixed(2),
          expenseAccountCode: accountCode,
          projectCode: str(line, "projectCode") ?? undefined,
          taxRateCode: str(line, "taxRateCode") ?? undefined,
        };
      });

      const result = await createBill({
        contactId: contact.id,
        supplierInvoiceNumber,
        billDate: utcDate(str(args, "billDate")),
        dueDate: str(args, "dueDate") ? utcDate(str(args, "dueDate")) : undefined,
        taxTotal: str(args, "taxTotal") ?? undefined,
        notes: str(args, "notes") ?? undefined,
        lines,
      });

      return {
        created: "bill draft",
        billNumber: result.bill.billNumber,
        vendor: contact.name,
        supplierInvoiceNumber,
        total: result.bill.total.toString(),
        status: "DRAFT",
        warnings: result.warnings ?? [],
        link: `/bills/${result.bill.id}`,
        note: "Nothing has been posted. The user must approve it from that page.",
      };
    },
  },
  {
    name: "create_contact",
    description:
      "Add a client or vendor. Postal code is required so duplicates can be detected. " +
      "Street and city are required for clients because they print on the invoice.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        isCustomer: { type: "boolean" },
        isVendor: { type: "boolean" },
        email: { type: "string" },
        addressLine1: { type: "string" },
        city: { type: "string" },
        province: { type: "string" },
        postalCode: { type: "string" },
        paymentTermsDays: { type: "string", description: "Defaults to 30" },
      },
      required: ["name", "postalCode"],
    },
    handler: async (args) => {
      const name = str(args, "name");
      const postalCode = str(args, "postalCode");
      if (!name) throw new Error("name is required.");
      if (!postalCode) throw new Error("postalCode is required so duplicates can be detected.");

      const isCustomer = bool(args, "isCustomer");
      const isVendor = bool(args, "isVendor");
      if (!isCustomer && !isVendor) {
        throw new Error("A contact must be a customer, a vendor, or both.");
      }

      const addressLine1 = str(args, "addressLine1");
      const city = str(args, "city");
      if (isCustomer && (!addressLine1 || !city)) {
        throw new Error("Clients need a street and city because they print on the invoice.");
      }

      const dedupeKey = buildDedupeKey(name, postalCode);
      if (dedupeKey) {
        const clash = await prisma.contact.findUnique({ where: { dedupeKey } });
        if (clash) throw new Error(`${clash.name} already exists at that postal code.`);
      }

      const terms = Number.parseInt(str(args, "paymentTermsDays") ?? "30", 10);

      const contact = await prisma.contact.create({
        data: {
          name,
          isCustomer,
          isVendor,
          email: str(args, "email"),
          addressLine1,
          city,
          province: str(args, "province"),
          postalCode,
          paymentTermsDays: Number.isInteger(terms) && terms >= 0 ? terms : 30,
          dedupeKey,
        },
      });

      return {
        created: "contact",
        name: contact.name,
        isCustomer: contact.isCustomer,
        isVendor: contact.isVendor,
        link: `/contacts/${contact.id}`,
      };
    },
  },
];
