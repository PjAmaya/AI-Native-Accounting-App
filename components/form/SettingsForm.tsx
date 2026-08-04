"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { saveOrgProfile, type FormState } from "@/app/(app)/settings/actions";
import { Field, Section, inputClass } from "./fields";

export type ProfileValues = {
  legalName: string;
  tradeName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  businessNumber: string;
  hstRegisteredFrom: string;
  paymentInstructions: string;
  invoiceFooter: string;
  capitalizationThreshold: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9] disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export function SettingsForm({ values }: { values: ProfileValues }) {
  const [state, action] = useActionState<FormState, FormData>(saveOrgProfile, null);
  const err = (key: string) => state?.errors?.[key];

  return (
    <form action={action} className="grid gap-4">
      <Section title="Business" description="This appears at the top of every invoice.">
        <Field label="Legal name" htmlFor="legalName" error={err("legalName")}>
          <input
            id="legalName"
            name="legalName"
            defaultValue={values.legalName}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label="Trade name"
          htmlFor="tradeName"
          hint="Leave blank if she invoices under her own name."
        >
          <input
            id="tradeName"
            name="tradeName"
            defaultValue={values.tradeName}
            placeholder="Story Craft Studio"
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email}
              className={inputClass}
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={values.phone} className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="Address">
        <Field label="Street" htmlFor="addressLine1">
          <input
            id="addressLine1"
            name="addressLine1"
            defaultValue={values.addressLine1}
            className={inputClass}
          />
        </Field>
        <Field label="Suite or unit" htmlFor="addressLine2">
          <input
            id="addressLine2"
            name="addressLine2"
            defaultValue={values.addressLine2}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" htmlFor="city">
            <input id="city" name="city" defaultValue={values.city} className={inputClass} />
          </Field>
          <Field label="Province" htmlFor="province">
            <input
              id="province"
              name="province"
              defaultValue={values.province}
              className={inputClass}
            />
          </Field>
          <Field label="Postal code" htmlFor="postalCode">
            <input
              id="postalCode"
              name="postalCode"
              defaultValue={values.postalCode}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Tax"
        description="Leave the registration date blank until she registers for HST. No tax will appear on invoices before it."
      >
        <Field
          label="Business number"
          htmlFor="businessNumber"
          hint="The nine-digit BN, or the full RT number once registered."
        >
          <input
            id="businessNumber"
            name="businessNumber"
            defaultValue={values.businessNumber}
            className={inputClass}
          />
        </Field>
        <Field
          label="HST registered from"
          htmlFor="hstRegisteredFrom"
          hint="Documents dated before this keep their original treatment."
          error={err("hstRegisteredFrom")}
        >
          <input
            id="hstRegisteredFrom"
            name="hstRegisteredFrom"
            type="date"
            defaultValue={values.hstRegisteredFrom}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Invoice">
        <Field
          label="Payment instructions"
          htmlFor="paymentInstructions"
          hint="Shown in the box on the left of every invoice. Line breaks are preserved."
        >
          <textarea
            id="paymentInstructions"
            name="paymentInstructions"
            rows={4}
            defaultValue={values.paymentInstructions}
            className={inputClass}
          />
        </Field>
        <Field label="Footer" htmlFor="invoiceFooter">
          <input
            id="invoiceFooter"
            name="invoiceFooter"
            defaultValue={values.invoiceFooter}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section
        title="Policy"
        description="Purchases at or above this amount are flagged as possible capital assets."
      >
        <Field
          label="Capitalization threshold"
          htmlFor="capitalizationThreshold"
          error={err("capitalizationThreshold")}
        >
          <input
            id="capitalizationThreshold"
            name="capitalizationThreshold"
            defaultValue={values.capitalizationThreshold}
            inputMode="decimal"
            className={`${inputClass} max-w-40 font-mono`}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3 py-1">
        <SubmitButton />
        {state ? (
          <p
            className={`flex items-center gap-1.5 text-[13px] ${state.ok ? "text-positive" : "text-negative"}`}
            role="status"
          >
            {state.ok ? (
              <Check size={14} strokeWidth={2.2} aria-hidden />
            ) : (
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden />
            )}
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
