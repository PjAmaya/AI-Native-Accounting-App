import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ContactForm, type ContactValues } from "@/components/form/ContactForm";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const values: ContactValues = {
    id: contact.id,
    name: contact.name,
    isCustomer: contact.isCustomer,
    isVendor: contact.isVendor,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    addressLine1: contact.addressLine1 ?? "",
    addressLine2: contact.addressLine2 ?? "",
    city: contact.city ?? "",
    province: contact.province ?? "",
    postalCode: contact.postalCode ?? "",
    businessNumber: contact.businessNumber ?? "",
    isHstRegistered: contact.isHstRegistered,
    paymentTermsDays: String(contact.paymentTermsDays),
    notes: contact.notes ?? "",
  };

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Contacts
      </Link>
      <h1 className="page-title mt-3">{contact.name}</h1>
      {!contact.postalCode ? (
        <p className="mt-2 text-[13px] text-warn">
          This contact has no postal code. Add one so duplicates can be detected.
        </p>
      ) : null}
      <div className="mt-7">
        <ContactForm values={values} />
      </div>
    </div>
  );
}
