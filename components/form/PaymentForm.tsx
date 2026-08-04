"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Decimal from "decimal.js";
import { TriangleAlert, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { savePaymentAction, type PaymentFormState } from "@/app/(app)/payments/actions";
import { inputClass } from "./fields";

export type OpenDoc = {
  kind: "INVOICE" | "BILL";
  key: string;
  label: string;
  contactId: string;
  dueDate: string;
  total: string;
  outstanding: string;
};

export type PaymentFormOptions = {
  customers: { value: string; label: string }[];
  vendors: { value: string; label: string }[];
  bankAccounts: { value: string; label: string }[];
  openDocs: OpenDoc[];
  defaultDate: string;
};

function dec(value: string) {
  try {
    return value ? new Decimal(value) : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

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

const numInput =
  "w-32 rounded-md border border-rule bg-surface px-2 py-1.5 text-right font-mono tabular-nums " +
  "text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export type PaymentValues = {
  id: string;
  direction: "RECEIVED" | "SENT";
  contactId: string;
  paymentDate: string;
  amount: string;
  bankAccountCode: string;
  method: string;
  reference: string;
  notes: string;
  applied: Record<string, string>;
};

export function PaymentForm({
  options,
  values,
}: {
  options: PaymentFormOptions;
  values?: PaymentValues;
}) {
  const [state, action] = useActionState<PaymentFormState, FormData>(savePaymentAction, null);
  const err = (key: string) => state?.errors?.[key];

  const [direction, setDirection] = useState<"RECEIVED" | "SENT">(values?.direction ?? "RECEIVED");
  const [contactId, setContactId] = useState(values?.contactId ?? "");
  const [paymentDate, setPaymentDate] = useState(values?.paymentDate ?? options.defaultDate);
  const [amount, setAmount] = useState(values?.amount ?? "");
  const [bankAccountCode, setBankAccountCode] = useState(
    values?.bankAccountCode ?? options.bankAccounts[0]?.value ?? "",
  );
  const [method, setMethod] = useState(values?.method ?? "");
  const [reference, setReference] = useState(values?.reference ?? "");
  const [notes, setNotes] = useState(values?.notes ?? "");
  const [applied, setApplied] = useState<Record<string, string>>(values?.applied ?? {});

  const wantedKind = direction === "RECEIVED" ? "INVOICE" : "BILL";
  const contacts = direction === "RECEIVED" ? options.customers : options.vendors;

  const docs = useMemo(
    () => options.openDocs.filter((d) => d.kind === wantedKind && d.contactId === contactId),
    [options.openDocs, wantedKind, contactId],
  );

  const totalApplied = docs.reduce((sum, d) => sum.plus(dec(applied[d.key] ?? "")), new Decimal(0));
  const paymentAmount = dec(amount);
  const unapplied = paymentAmount.minus(totalApplied);
  const over = totalApplied.greaterThan(paymentAmount);

  function switchDirection(next: "RECEIVED" | "SENT") {
    setDirection(next);
    setContactId("");
    setApplied({});
  }

  function autoApply() {
    const remaining = { value: paymentAmount };
    const next: Record<string, string> = {};
    for (const doc of [...docs].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      if (remaining.value.lessThanOrEqualTo(0)) break;
      const outstanding = dec(doc.outstanding);
      const take = Decimal.min(outstanding, remaining.value);
      next[doc.key] = take.toFixed(2);
      remaining.value = remaining.value.minus(take);
    }
    setApplied(next);
  }

  return (
    <form action={action} className="grid gap-5">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="direction" value={direction} />

      <section className="card px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          {(["RECEIVED", "SENT"] as const).map((d) => {
            const active = direction === d;
            const Icon = d === "RECEIVED" ? ArrowDownLeft : ArrowUpRight;
            return (
              <button
                key={d}
                type="button"
                onClick={() => switchDirection(d)}
                className={
                  "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors " +
                  (active
                    ? "border-brand bg-brand-soft"
                    : "border-rule hover:bg-wash/40")
                }
              >
                <Icon
                  size={16}
                  strokeWidth={1.9}
                  aria-hidden
                  className={active ? "mt-0.5 text-brand" : "mt-0.5 text-faint"}
                />
                <span>
                  <span className="block text-[13px] font-medium">
                    {d === "RECEIVED" ? "Money received" : "Money sent"}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-faint">
                    {d === "RECEIVED" ? "A client paid us" : "We paid a vendor"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label htmlFor="contactId" className="eyebrow">
              {direction === "RECEIVED" ? "Client" : "Vendor"}
            </label>
            <select
              id="contactId"
              name="contactId"
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                setApplied({});
              }}
              className={`${inputClass} mt-1.5`}
              required
            >
              <option value="" disabled>Choose one</option>
              {contacts.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {err("contactId") ? (
              <p className="mt-1 text-[12px] text-negative">{err("contactId")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="paymentDate" className="eyebrow">Date</label>
            <input
              id="paymentDate"
              name="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={`${inputClass} mt-1.5`}
              required
            />
          </div>
          <div>
            <label htmlFor="amount" className="eyebrow">Amount</label>
            <input
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className={`${inputClass} mt-1.5 text-right font-mono tabular-nums`}
              required
            />
            {err("amount") ? (
              <p className="mt-1 text-[12px] text-negative">{err("amount")}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="bankAccountCode" className="eyebrow">Account</label>
            <select
              id="bankAccountCode"
              name="bankAccountCode"
              value={bankAccountCode}
              onChange={(e) => setBankAccountCode(e.target.value)}
              className={`${inputClass} mt-1.5`}
              required
            >
              {options.bankAccounts.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="method" className="eyebrow">Method</label>
            <input
              id="method"
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="EFT, cheque, e-transfer"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="reference" className="eyebrow">Reference</label>
            <input
              id="reference"
              name="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Confirmation number"
              className={`${inputClass} mt-1.5`}
            />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <p className="eyebrow">Apply to</p>
          {docs.length > 0 && paymentAmount.greaterThan(0) ? (
            <button
              type="button"
              onClick={autoApply}
              className="rounded-lg border border-rule bg-surface px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-wash/60"
            >
              Apply oldest first
            </button>
          ) : null}
        </div>

        {!contactId ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            Choose a {direction === "RECEIVED" ? "client" : "vendor"} to see their open{" "}
            {direction === "RECEIVED" ? "invoices" : "bills"}.
          </p>
        ) : docs.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            Nothing open. The full amount will be recorded as unapplied.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-wash/40">
                <th className="px-5 py-2.5 text-left"><span className="eyebrow">Document</span></th>
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Due</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Total</span></th>
                <th className="px-3 py-2.5 text-right"><span className="eyebrow">Outstanding</span></th>
                <th className="px-5 py-2.5 text-right"><span className="eyebrow">Apply</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {docs.map((doc) => (
                <tr key={doc.key} className="hover:bg-wash/20">
                  <td className="px-5 py-2.5 font-mono text-[12px]">{doc.label}</td>
                  <td className="px-3 py-2.5 text-[13px] text-muted">{doc.dueDate}</td>
                  <td className="figure px-3 py-2.5">{dec(doc.total).toFixed(2)}</td>
                  <td className="figure px-3 py-2.5">{dec(doc.outstanding).toFixed(2)}</td>
                  <td className="px-5 py-2 text-right">
                    <input
                      name={`${doc.kind === "INVOICE" ? "applyInvoice" : "applyBill"}:${doc.key}`}
                      value={applied[doc.key] ?? ""}
                      onChange={(e) =>
                        setApplied((prev) => ({ ...prev, [doc.key]: e.target.value }))
                      }
                      onFocus={(e) => {
                        if (!applied[doc.key]) e.target.value = "";
                      }}
                      placeholder={dec(doc.outstanding).toFixed(2)}
                      inputMode="decimal"
                      className={numInput}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-start justify-between gap-6 border-t border-rule bg-wash/20 px-5 py-3">
          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              name="postImmediately"
              defaultChecked={!values}
              className="mt-0.5 h-4 w-4 accent-[#1b3be8]"
            />
            <span>
              Post to the ledger now
              <span className="mt-0.5 block text-[12px] text-faint">
                Leave unticked to keep it as a draft for review.
              </span>
            </span>
          </label>

          <div className="w-64">
            <div className="flex justify-between py-1 text-[13px]">
              <span className="text-muted">Applied</span>
              <span className="figure">${totalApplied.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-rule py-1.5 text-[13px] font-semibold">
              <span>{over ? "Over-applied" : "Unapplied"}</span>
              <span className={`figure !text-[15px] ${over ? "text-negative" : ""}`}>
                ${unapplied.abs().toFixed(2)}
              </span>
            </div>
            {unapplied.greaterThan(0) ? (
              <p className="mt-1 text-[11px] text-faint">
                Goes to {direction === "RECEIVED" ? "2060 Customer Overpayments" : "1300 Prepaid Expenses"}.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card px-6 py-5">
        <label htmlFor="notes" className="eyebrow">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClass} mt-1.5`}
        />
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton label={values ? "Save payment" : "Record payment"} />
        {state && !state.ok ? (
          <p className="flex items-center gap-1.5 text-[13px] text-negative" role="status">
            <TriangleAlert size={14} strokeWidth={2.2} aria-hidden />
            {state.message}
          </p>
        ) : null}
      </div>
      {err("applications") ? (
        <p className="text-[12px] text-negative">{err("applications")}</p>
      ) : null}
    </form>
  );
}
