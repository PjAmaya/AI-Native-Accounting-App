"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { saveContact, type ContactFormState } from "@/app/(app)/contacts/actions";
import { Field, Section, inputClass } from "./fields";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9] disabled:opacity-50"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

function Check({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rule px-3.5 py-3 hover:bg-wash/40">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b3be8]"
      />
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export type ContactValues = {
  id: string;
  name: string;
  isCustomer: boolean;
  isVendor: boolean;
  isActive: boolean;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  businessNumber: string;
  isHstRegistered: boolean;
  paymentTermsDays: string;
  receivableAccountCode: string;
  notes: string;
};

export function ContactForm({
  values,
  receivableAccounts = [],
}: {
  values?: ContactValues;
  receivableAccounts?: { value: string; label: string }[];
}) {
  const [state, action] = useActionState<ContactFormState, FormData>(saveContact, null);
  const err = (key: string) => state?.errors?.[key];
  const v = values;

  return (
    <form action={action} className="grid gap-4">
      {v ? <input type="hidden" name="id" value={v.id} /> : null}
      <Section title="Identity">
        <Field label="Name" htmlFor="name" error={err("name")}>
          <input id="name" name="name" defaultValue={v?.name} className={inputClass} required autoFocus />
        </Field>

        <div>
          <p className="text-[13px] font-medium text-ink">Role</p>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <Check name="isCustomer" label="Customer" hint="You invoice them" defaultChecked={v?.isCustomer} />
            <Check name="isVendor" label="Vendor" hint="They invoice you" defaultChecked={v?.isVendor} />
            <Check name="isActive" label="Active" hint="Inactive contacts leave all dropdowns" defaultChecked={v?.isActive ?? true} />
          </div>
          {err("roles") ? (
            <p className="mt-1 text-[12px] text-negative">{err("roles")}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" htmlFor="email">
            <input id="email" name="email" type="email" defaultValue={v?.email} className={inputClass} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={v?.phone} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section
        title="Address"
        description="Postal code is required for everyone. Street and city are required for customers, since they print on the invoice."
      >
        <Field label="Street" htmlFor="addressLine1" error={err("addressLine1")}>
          <input id="addressLine1" name="addressLine1" defaultValue={v?.addressLine1} className={inputClass} />
        </Field>
        <Field label="Suite or unit" htmlFor="addressLine2">
          <input id="addressLine2" name="addressLine2" defaultValue={v?.addressLine2} className={inputClass} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" htmlFor="city" error={err("city")}>
            <input id="city" name="city" defaultValue={v?.city} className={inputClass} />
          </Field>
          <Field label="Province" htmlFor="province">
            <input id="province" name="province" defaultValue={v?.province ?? "ON"} className={inputClass} />
          </Field>
          <Field label="Postal code" htmlFor="postalCode" error={err("postalCode")}>
            <input id="postalCode" name="postalCode" defaultValue={v?.postalCode} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="Terms and tax">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Payment terms"
            htmlFor="paymentTermsDays"
            hint="Days. Sets the due date on their invoices."
            error={err("paymentTermsDays")}
          >
            <input
              id="paymentTermsDays"
              name="paymentTermsDays"
              defaultValue={v?.paymentTermsDays ?? "30"}
              inputMode="numeric"
              className={`${inputClass} max-w-28 font-mono`}
            />
          </Field>
          <Field label="Business number" htmlFor="businessNumber">
            <input id="businessNumber" name="businessNumber" defaultValue={v?.businessNumber} className={inputClass} />
          </Field>
        </div>
        <Check
          name="isHstRegistered"
          label="Registered for HST"
          hint="Only matters for vendors — it decides whether their tax is recoverable."
          defaultChecked={v?.isHstRegistered}
        />
        <Field
          label="Receivable account"
          htmlFor="receivableAccountCode"
          hint="Where their invoices post. Use partner receivables for cost recoveries."
          error={err("receivableAccountCode")}
        >
          <select
            id="receivableAccountCode"
            name="receivableAccountCode"
            defaultValue={v?.receivableAccountCode ?? ""}
            className={inputClass}
          >
            <option value="">Default</option>
            {receivableAccounts.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes" htmlFor="notes">
          <textarea id="notes" name="notes" rows={3} defaultValue={v?.notes} className={inputClass} />
        </Field>
      </Section>

      <div className="flex items-center gap-3 py-1">
        <SubmitButton label={v ? "Save changes" : "Create contact"} />
        {state && !state.ok ? (
          <p className="flex items-center gap-1.5 text-[13px] text-negative" role="status">
            <TriangleAlert size={14} strokeWidth={2.2} aria-hidden />
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
