"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Decimal from "decimal.js";
import { TriangleAlert } from "lucide-react";
import type { PaymentFormState } from "@/app/(app)/payments/actions";
import type { OpenDoc } from "./PaymentForm";
import { inputClass } from "./fields";

function dec(value: string) {
  try {
    return value ? new Decimal(value) : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9] disabled:opacity-50"
    >
      {pending ? "Applying..." : "Apply payment"}
    </button>
  );
}

const numInput =
  "w-32 rounded-md border border-rule bg-surface px-2 py-1.5 text-right font-mono tabular-nums " +
  "text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function ApplyPaymentForm({
  action: boundAction,
  docs,
  unapplied,
  direction,
  minDate,
  defaultDate,
}: {
  action: (state: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;
  docs: OpenDoc[];
  unapplied: string;
  direction: "RECEIVED" | "SENT";
  minDate: string;
  defaultDate: string;
}) {
  const [state, action] = useActionState<PaymentFormState, FormData>(boundAction, null);
  const [applicationDate, setApplicationDate] = useState(defaultDate);
  const [applied, setApplied] = useState<Record<string, string>>(() => {
    const only = docs.length === 1 ? docs[0] : undefined;
    if (!only) return {};
    return { [only.key]: Decimal.min(dec(only.outstanding), dec(unapplied)).toFixed(2) };
  });

  const available = dec(unapplied);
  const totalApplied = docs.reduce((sum, d) => sum.plus(dec(applied[d.key] ?? "")), new Decimal(0));
  const remaining = available.minus(totalApplied);
  const over = remaining.lessThan(0);
  const from = direction === "RECEIVED" ? "2060 Customer Overpayments" : "1300 Prepaid Expenses";
  const to = direction === "RECEIVED" ? "Accounts Receivable" : "2010 Accounts Payable";

  return (
    <form action={action} className="grid gap-5">
      <section className="card overflow-hidden">
        <div className="flex items-end justify-between gap-4 border-b border-rule px-5 py-3">
          <p className="eyebrow">Apply to</p>
          <div>
            <label htmlFor="applicationDate" className="eyebrow">Application date</label>
            <input
              id="applicationDate"
              name="applicationDate"
              type="date"
              min={minDate}
              value={applicationDate}
              onChange={(e) => setApplicationDate(e.target.value)}
              className={`${inputClass} mt-1 !py-1.5 !text-[13px]`}
              required
            />
          </div>
        </div>

        {docs.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            This contact has nothing open to apply the payment to.
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
                      onChange={(e) => setApplied((prev) => ({ ...prev, [doc.key]: e.target.value }))}
                      inputMode="decimal"
                      aria-label={`Amount to apply to ${doc.label}`}
                      className={numInput}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-start justify-between gap-6 border-t border-rule bg-wash/20 px-5 py-3">
          <p className="max-w-sm text-[12px] text-faint">
            Posts one entry per document moving the amount out of {from} into {to}. The original
            payment entry is not changed.
          </p>
          <div className="w-64">
            <div className="flex justify-between py-1 text-[13px]">
              <span className="text-muted">Unapplied now</span>
              <span className="figure">${available.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-[13px]">
              <span className="text-muted">Applying</span>
              <span className="figure">${totalApplied.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-rule py-1.5 text-[13px] font-semibold">
              <span>{over ? "Over-applied" : "Still unapplied"}</span>
              <span className={`figure !text-[15px] ${over ? "text-negative" : ""}`}>
                ${remaining.abs().toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={over || totalApplied.lessThanOrEqualTo(0)} />
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
