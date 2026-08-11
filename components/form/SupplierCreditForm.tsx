"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Decimal from "decimal.js";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  saveSupplierCreditAction,
  type SupplierCreditFormState,
} from "@/app/(app)/supplier-credits/actions";
import { inputClass } from "./fields";

export type Option = { value: string; label: string };

export type SupplierCreditFormOptions = {
  vendors: Option[];
  bills: { value: string; label: string; contactId: string }[];
  projects: Option[];
  expenseAccounts: Option[];
  taxRates: Option[];
  defaultDate: string;
  presetContactId?: string;
  presetBillId?: string;
};

type Row = {
  key: number;
  description: string;
  amount: string;
  expenseAccount: string;
  project: string;
  taxRate: string;
};

let nextKey = 1;
const blankRow = (): Row => ({
  key: nextKey++,
  description: "",
  amount: "",
  expenseAccount: "",
  project: "",
  taxRate: "",
});

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

const cell =
  "w-full rounded-md border border-rule bg-surface px-2 py-1.5 text-[13px] " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const numCell = `${cell} text-right font-mono tabular-nums`;

export type SupplierCreditValues = {
  id: string;
  contactId: string;
  supplierCreditNumber: string;
  originalBillId: string;
  creditDate: string;
  reason: string;
  notes: string;
  taxTotal: string;
  lines: {
    description: string;
    amount: string;
    expenseAccount: string;
    project: string;
    taxRate: string;
  }[];
};

export function SupplierCreditForm({
  options,
  values,
}: {
  options: SupplierCreditFormOptions;
  values?: SupplierCreditValues;
}) {
  const [state, action] = useActionState<SupplierCreditFormState, FormData>(
    saveSupplierCreditAction,
    null,
  );
  const err = (key: string) => state?.errors?.[key];

  const [contactId, setContactId] = useState(values?.contactId ?? options.presetContactId ?? "");
  const [originalBillId, setOriginalBillId] = useState(
    values?.originalBillId ?? options.presetBillId ?? "",
  );
  const [supplierCreditNumber, setSupplierCreditNumber] = useState(
    values?.supplierCreditNumber ?? "",
  );
  const [creditDate, setCreditDate] = useState(values?.creditDate ?? options.defaultDate);
  const [reason, setReason] = useState(values?.reason ?? "");
  const [notes, setNotes] = useState(values?.notes ?? "");
  const [taxTotal, setTaxTotal] = useState(values?.taxTotal ?? "");
  const [rows, setRows] = useState<Row[]>(
    values && values.lines.length > 0
      ? values.lines.map((line) => ({ ...blankRow(), ...line }))
      : [blankRow()],
  );

  const set = (key: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const subtotal = rows.reduce((sum, r) => sum.plus(dec(r.amount)), new Decimal(0));
  const total = subtotal.plus(dec(taxTotal));
  const vendorBills = options.bills.filter((b) => b.contactId === contactId);

  return (
    <form action={action} className="grid gap-5">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}
      <section className="card px-6 py-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label htmlFor="contactId" className="eyebrow">Vendor</label>
            <select
              id="contactId"
              name="contactId"
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                setOriginalBillId("");
              }}
              className={`${inputClass} mt-1.5`}
              required
            >
              <option value="" disabled>Choose a vendor</option>
              {options.vendors.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            {err("contactId") ? (
              <p className="mt-1 text-[12px] text-negative">{err("contactId")}</p>
            ) : null}
          </div>
          <div className="col-span-2">
            <label htmlFor="supplierCreditNumber" className="eyebrow">Their credit number</label>
            <input
              id="supplierCreditNumber"
              name="supplierCreditNumber"
              value={supplierCreditNumber}
              onChange={(e) => setSupplierCreditNumber(e.target.value)}
              placeholder="As printed on their credit note"
              className={`${inputClass} mt-1.5`}
              required
            />
            {err("supplierCreditNumber") ? (
              <p className="mt-1 text-[12px] text-negative">{err("supplierCreditNumber")}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label htmlFor="originalBillId" className="eyebrow">Credits bill</label>
            <select
              id="originalBillId"
              name="originalBillId"
              value={originalBillId}
              onChange={(e) => setOriginalBillId(e.target.value)}
              className={`${inputClass} mt-1.5`}
            >
              <option value="">None — standalone credit</option>
              {vendorBills.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="creditDate" className="eyebrow">Date</label>
            <input
              id="creditDate"
              name="creditDate"
              type="date"
              value={creditDate}
              onChange={(e) => setCreditDate(e.target.value)}
              className={`${inputClass} mt-1.5`}
              required
            />
          </div>
          <div>
            <label htmlFor="reason" className="eyebrow">Reason</label>
            <input
              id="reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Overbilled hours"
              className={`${inputClass} mt-1.5`}
              required
            />
            {err("reason") ? (
              <p className="mt-1 text-[12px] text-negative">{err("reason")}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-wash/40">
              <th className="w-9 px-3 py-2.5 text-left"><span className="eyebrow">#</span></th>
              <th className="px-2 py-2.5 text-left"><span className="eyebrow">Description</span></th>
              <th className="w-52 px-2 py-2.5 text-left"><span className="eyebrow">Account</span></th>
              <th className="w-32 px-2 py-2.5 text-left"><span className="eyebrow">Project</span></th>
              <th className="w-28 px-2 py-2.5 text-left"><span className="eyebrow">Tax</span></th>
              <th className="w-32 px-2 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((row, i) => (
              <tr key={row.key} className="hover:bg-wash/20">
                <td className="px-3 py-1 text-[12px] text-faint">{i + 1}</td>
                <td className="px-1 py-1">
                  <input
                    name="lineDescription"
                    value={row.description}
                    onChange={(e) => set(row.key, "description", e.target.value)}
                    placeholder="What is being credited"
                    className={cell}
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    name="lineExpenseAccount"
                    value={row.expenseAccount}
                    onChange={(e) => set(row.key, "expenseAccount", e.target.value)}
                    className={`${cell} text-[12px]`}
                  >
                    <option value="">Choose</option>
                    {options.expenseAccounts.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select
                    name="lineProject"
                    value={row.project}
                    onChange={(e) => set(row.key, "project", e.target.value)}
                    className={`${cell} text-[12px]`}
                  >
                    <option value="">—</option>
                    {options.projects.map((p) => (
                      <option key={p.value} value={p.value}>{p.value}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <select
                    name="lineTaxRate"
                    value={row.taxRate}
                    onChange={(e) => set(row.key, "taxRate", e.target.value)}
                    className={`${cell} text-[12px]`}
                  >
                    <option value="">No tax</option>
                    {options.taxRates.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input
                    name="lineAmount"
                    value={row.amount}
                    onChange={(e) => set(row.key, "amount", e.target.value)}
                    inputMode="decimal"
                    className={numCell}
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== row.key)))
                    }
                    disabled={rows.length === 1}
                    aria-label={`Remove line ${i + 1}`}
                    className="text-faint transition-colors hover:text-negative disabled:opacity-25"
                  >
                    <Trash2 size={14} strokeWidth={1.9} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-start justify-between gap-6 border-t border-rule bg-wash/20 px-3 py-3">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, blankRow()])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-wash/60"
          >
            <Plus size={14} strokeWidth={2.2} aria-hidden />
            Add line
          </button>

          <div className="w-72">
            <div className="flex items-center justify-between py-1 text-[13px]">
              <span className="text-muted">Subtotal</span>
              <span className="figure">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
              <label htmlFor="taxTotal" className="text-muted">Tax on their credit</label>
              <input
                id="taxTotal"
                name="taxTotal"
                value={taxTotal}
                onChange={(e) => setTaxTotal(e.target.value)}
                placeholder="auto"
                inputMode="decimal"
                className={`${numCell} w-28`}
              />
            </div>
            <div className="flex justify-between border-t border-rule py-1.5 text-[13px] font-semibold">
              <span>Total</span>
              <span className="figure !text-[15px]">${total.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-[11px] text-faint">Enter positive amounts.</p>
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

      {rows.some((_, i) => err(`line-${i}`)) || err("lines") ? (
        <ul className="text-[12px] text-negative">
          {err("lines") ? <li>{err("lines")}</li> : null}
          {rows.map((_, i) =>
            err(`line-${i}`) ? <li key={i}>Line {i + 1}: {err(`line-${i}`)}</li> : null,
          )}
        </ul>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton label={values ? "Save draft" : "Record credit"} />
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
