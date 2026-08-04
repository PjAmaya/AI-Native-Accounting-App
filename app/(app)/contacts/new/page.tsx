import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContactForm } from "@/components/form/ContactForm";

export default function NewContactPage() {
  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Contacts
      </Link>
      <h1 className="page-title mt-3">New contact</h1>
      <div className="mt-7">
        <ContactForm />
      </div>
    </div>
  );
}
