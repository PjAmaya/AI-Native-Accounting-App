"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Decimal from "decimal.js";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { saveInvoiceAction, type InvoiceFormState } from "@/app/(app)/invoices/actions";
import { inputClass } from "./fields";
import { computeInvoiceTotals } from "@/lib/invoicing/tax";

export type Option = { value: string; label: string };

export type InvoiceFormOptions = {
  clients: Option[];
  projects: Option[];
  revenueAccounts: Option[];
  taxRates: Option[];
  taxRatePercents: Record<string, string>;
  defaultDate: string;
};

type Row = {
  key: number;
  description: string;
  quantity: string;
  unitRate: string;
  amount: string;
  revenueAccount: string;
  project: string;
  taxRate: string;
};

let nextKey = 1;
const blankRow = (): Row => ({
  key: nextKey++,
  description: "",
  quantity: "1",
  unitRate: "",
  amount: "",
  revenueAccount: "4010",
  project: "",
  taxRate: "",
});

function lineTotal(row: Row) {
  if (!row.quantity || !row.unitRate) return new Decimal(0);
  try {
    return new Decimal(row.quantity)
      .times(row.unitRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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
const computedCell =
  "w-full rounded-md bg-wash/70 px-2 py-1.5 text-right font-mono tabular-nums text-[13px] text-ink";

export type InvoiceValues = {
  id: string;
  contactId: string;
  invoiceDate: string;
  dueDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  projectCode: string;
  clientReference: string;
  notes: string;
  lines: {
    description: string;
    quantity: string;
    unitRate: string;
    amount: string;
    revenueAccount: string;
    project: string;
    taxRate: string;
  }[];
};

export function InvoiceForm({
  options,
  values,
}: {
  options: InvoiceFormOptions;
  values?: InvoiceValues;
}) {
  const [state, action] = useActionState<InvoiceFormState, FormData>(saveInvoiceAction, null);
  const err = (key: string) => state?.errors?.[key];

  const [contactId, setContactId] = useState(values?.contactId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(values?.invoiceDate ?? options.defaultDate);
  const [dueDate, setDueDate] = useState(values?.dueDate ?? "");
  const [periodStart, setPeriodStart] = useState(values?.servicePeriodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(values?.servicePeriodEnd ?? "");
  const [projectCode, setProjectCode] = useState(values?.projectCode ?? "");
  const [clientReference, setClientReference] = useState(values?.clientReference ?? "");
  const [notes, setNotes] = useState(values?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    values
      ? values.lines.map((line) => ({ ...blankRow(), ...line }))
      : [blankRow(), blankRow()],
  );

  const set = (key: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const priced = rows.filter((r) => r.quantity && r.unitRate);
  const preview = computeInvoiceTotals(
    priced.map((r) => ({
      amount: lineTotal(r).toFixed(2),
      ratePercent: r.taxRate ? (options.taxRatePercents[r.taxRate] ?? "0") : "0",
    })),
  );
  const subtotal = preview.subtotal;
  const filled = priced.filter((r) => r.description).length;

  return (
    <form action={action} className="grid gap-5">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}
      <section className="card px-6 py-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label htmlFor="contactId" className="eyebrow">Customer</label>
            <select
              id="contactId"
              name="contactId"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className={`${inputClass} mt-1.5`}
              required
            >
              <option value="" disabled>Choose a client</option>
              {options.clients.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {err("contactId") ? (
              <p className="mt-1 text-[12px] text-negative">{err("contactId")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="invoiceDate" className="eyebrow">Invoice date</label>
            <input
              id="invoiceDate"
              name="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={`${inputClass} mt-1.5`}
              required
            />
          </div>
          <div>
            <label htmlFor="dueDate" className="eyebrow">Due date</label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
            {err("dueDate") ? (
              <p className="mt-1 text-[12px] text-negative">{err("dueDate")}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-4">
          <div>
            <label htmlFor="servicePeriodStart" className="eyebrow">Work from</label>
            <input
              id="servicePeriodStart"
              name="servicePeriodStart"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="servicePeriodEnd" className="eyebrow">Work to</label>
            <input
              id="servicePeriodEnd"
              name="servicePeriodEnd"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="projectCode" className="eyebrow">Default project</label>
            <select
              id="projectCode"
              name="projectCode"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className={`${inputClass} mt-1.5`}
            >
              <option value="">None</option>
              {options.projects.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="clientReference" className="eyebrow">PO / reference</label>
            <input
              id="clientReference"
              name="clientReference"
              value={clientReference}
              onChange={(e) => setClientReference(e.target.value)}
              className={`${inputClass} mt-1.5`}
            />
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule bg-wash/40">
              <th className="w-9 px-3 py-2.5 text-left"><span className="eyebrow">#</span></th>
              <th className="px-2 py-2.5 text-left"><span className="eyebrow">Description</span></th>
              <th className="w-36 px-2 py-2.5 text-left"><span className="eyebrow">Account</span></th>
              <th className="w-32 px-2 py-2.5 text-left"><span className="eyebrow">Project</span></th>
              <th className="w-20 px-2 py-2.5 text-right"><span className="eyebrow">Qty</span></th>
              <th className="w-24 px-2 py-2.5 text-right"><span className="eyebrow">Rate</span></th>
              <th className="w-28 px-2 py-2.5 text-right"><span className="eyebrow">Amount</span></th>
              <th className="w-28 px-2 py-2.5 text-left"><span className="eyebrow">Tax</span></th>
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
                    placeholder="What was delivered"
                    className={cell}
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    name="lineRevenueAccount"
                    value={row.revenueAccount}
                    onChange={(e) => set(row.key, "revenueAccount", e.target.value)}
                    className={`${cell} text-[12px]`}
                  >
                    {options.revenueAccounts.map((a) => (
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
                  <input
                    name="lineQuantity"
                    value={row.quantity}
                    onChange={(e) => set(row.key, "quantity", e.target.value)}
                    inputMode="decimal"
                    className={numCell}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    name="lineUnitRate"
                    value={row.unitRate}
                    onChange={(e) => set(row.key, "unitRate", e.target.value)}
                    inputMode="decimal"
                    className={numCell}
                  />
                </td>
                <td className="px-1 py-1">
                  <div className={computedCell} aria-label={`Line ${i + 1} amount`}>
                    {row.quantity && row.unitRate ? lineTotal(row).toFixed(2) : "—"}
                  </div>
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, blankRow()])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-wash/60"
            >
              <Plus size={14} strokeWidth={2.2} aria-hidden />
              Add line
            </button>
            <button
              type="button"
              onClick={() => setRows([blankRow(), blankRow()])}
              className="rounded-lg px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink"
            >
              Clear all
            </button>
          </div>

          <div className="w-64">
            <div className="flex justify-between py-1 text-[13px]">
              <span className="text-muted">Lines</span>
              <span className="figure">{filled}</span>
            </div>
            <div className="flex justify-between border-t border-rule py-1 text-[13px]">
              <span className="text-muted">Subtotal</span>
              <span className="figure">${subtotal.toFixed(2)}</span>
            </div>
            {preview.taxTotal.greaterThan(0) ? (
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-muted">Tax</span>
                <span className="figure">${preview.taxTotal.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-rule py-1.5 text-[13px] font-semibold">
              <span>Total</span>
              <span className="figure !text-[15px]">${preview.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card px-6 py-5">
        <label htmlFor="notes" className="eyebrow">Notes on the invoice</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClass} mt-1.5`}
        />
      </section>

      {rows.some((_, i) => err(`line-${i}`)) ? (
        <ul className="text-[12px] text-negative">
          {rows.map((_, i) =>
            err(`line-${i}`) ? <li key={i}>Line {i + 1}: {err(`line-${i}`)}</li> : null,
          )}
        </ul>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton label={values ? "Save draft" : "Create draft"} />
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
