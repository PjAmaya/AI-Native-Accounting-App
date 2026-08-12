import { prisma } from "../db";
import { createGmailDraft } from "../google/gmail";
import { money } from "../format";

export async function emailInvoiceDraft(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { contact: true },
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "ISSUED" && invoice.status !== "PAID") {
    throw new Error("Only issued or paid invoices can be emailed.");
  }
  if (!invoice.contact.email) {
    throw new Error(`${invoice.contact.name} has no email address. Add one on the contact page.`);
  }

  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });

  const subject = `Invoice ${invoice.invoiceNumber} from ${profile.legalName}`;

  const htmlBody = `
<p>Hi,</p>
<p>Please find attached invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${money(invoice.total)}</strong>, due <strong>${invoice.dueDate.toISOString().slice(0, 10)}</strong>.</p>
${profile.paymentInstructions ? `<p><strong>Payment instructions:</strong><br>${profile.paymentInstructions.replace(/\n/g, "<br>")}</p>` : ""}
<p>Thank you for your business.</p>
<p>${profile.legalName}</p>
`.trim();

  const result = await createGmailDraft({
    to: invoice.contact.email,
    subject,
    htmlBody,
    from: profile.email ?? undefined,
  });

  return { ...result, to: invoice.contact.email, subject };
}
