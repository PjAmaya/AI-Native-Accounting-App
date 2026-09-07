import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { ContactForm, type ContactValues } from "@/components/form/ContactForm";
import { deleteContact } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { receivableAccount: true },
  });
  if (!contact) notFound();

  const receivables = await prisma.account.findMany({
    where: { type: "ASSET", isPostable: true, isActive: true, subType: "CURRENT_ASSET" },
    orderBy: { code: "asc" },
  });

  const values: ContactValues = {
    id: contact.id,
    name: contact.name,
    isCustomer: contact.isCustomer,
    isActive: contact.isActive,
    country: contact.country,
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
    receivableAccountCode: contact.receivableAccount?.code ?? "",
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
      <div className="mt-4 flex justify-end">
        <form action={deleteContact.bind(null, contact.id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden />
            Delete contact
          </button>
        </form>
      </div>
      <div className="mt-4">
        <ContactForm
          values={values}
          receivableAccounts={receivables.map((a) => ({
            value: a.code,
            label: `${a.code} ${a.name}`,
          }))}
        />
      </div>
    </div>
  );
}
