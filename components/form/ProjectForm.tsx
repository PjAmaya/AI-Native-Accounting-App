"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Decimal from "decimal.js";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { saveProject, type ProjectFormState } from "@/app/(app)/projects/actions";
import { Field, Section, inputClass } from "./fields";

export type Option = { value: string; label: string };

export type ProjectFormOptions = {
  clients: Option[];
  costAccounts: Option[];
};

export type ProjectValues = {
  id: string;
  code: string;
  name: string;
  contactId: string;
  status: string;
  scope: string;
  closureReason: string;
  startDate: string;
  endDate: string;
  notes: string;
  contractValue: string;
  budgets: { account: string; label: string; amount: string; note: string }[];
};

type Row = { key: number; account: string; label: string; amount: string; note: string };

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, account: "", label: "", amount: "", note: "" });

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

export function ProjectForm({
  options,
  values,
}: {
  options: ProjectFormOptions;
  values?: ProjectValues;
}) {
  const [state, action] = useActionState<ProjectFormState, FormData>(saveProject, null);
  const err = (key: string) => state?.errors?.[key];

  const [code, setCode] = useState(values?.code ?? "");
  const [projName, setProjName] = useState(values?.name ?? "");
  const [status, setStatus] = useState(values?.status ?? "ACTIVE");
  const [contractValue, setContractValue] = useState(values?.contractValue ?? "");
  const [rows, setRows] = useState<Row[]>(
    values && values.budgets.length > 0
      ? values.budgets.map((b) => ({ ...blankRow(), ...b }))
      : [blankRow()],
  );

  const set = (key: number, field: keyof Row, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const budgetedCost = rows.reduce((sum, r) => sum.plus(dec(r.amount)), new Decimal(0));
  const contract = dec(contractValue);
  const budgetedMargin = contract.minus(budgetedCost);
  const marginPercent = contract.greaterThan(0)
    ? budgetedMargin.dividedBy(contract).times(100).toDecimalPlaces(1)
    : null;

  return (
    <form action={action} className="grid gap-4">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}

      <Section title="Project">
        <div className="grid grid-cols-4 gap-4">
          <Field label="Code" htmlFor="code" hint="Short, e.g. PROJ-A" error={err("code")}>
            <input
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} font-mono`}
              required
            />
          </Field>
          <div className="col-span-3">
            <Field label="Name" htmlFor="name" error={err("name")}>
              <input id="name" name="name" value={projName} onChange={(e) => setProjName(e.target.value)} className={inputClass} required />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Client" htmlFor="contactId">
            <select
              id="contactId"
              name="contactId"
              defaultValue={values?.contactId ?? ""}
              className={inputClass}
            >
              <option value="">None</option>
              {options.clients.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Start" htmlFor="startDate">
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={values?.startDate}
              className={inputClass}
            />
          </Field>
          <Field label="End" htmlFor="endDate" error={err("endDate")}>
            <input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={values?.endDate}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Status"
          htmlFor="status"
          hint="Only active projects appear in invoice and bill dropdowns."
        >
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${inputClass} max-w-56`}
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>

        {status !== "ACTIVE" ? (
          <Field
            label={status === "COMPLETED" ? "How it finished" : "Why"}
            htmlFor="closureReason"
            hint="Recorded so you can compare completed against cancelled work later."
            error={err("closureReason")}
          >
            <textarea
              id="closureReason"
              name="closureReason"
              rows={2}
              defaultValue={values?.closureReason}
              placeholder={
                status === "CANCELLED"
                  ? "Client cancelled after discovery — scope was larger than budget"
                  : status === "ON_HOLD"
                    ? "Paused pending their board approval"
                    : "Delivered in full and final invoice issued"
              }
              className={inputClass}
            />
          </Field>
        ) : null}

        <Field
          label="Scope"
          htmlFor="scope"
          hint="What was agreed. Shown on the project page for reference."
        >
          <textarea
            id="scope"
            name="scope"
            rows={4}
            defaultValue={values?.scope}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section
        title="Budget"
        description="Contract value is what you agreed to bill. Cost budget is what you expect delivery to cost."
      >
        <Field
          label="Contract value"
          htmlFor="contractValue"
          hint="Leave blank if the engagement is open-ended."
          error={err("contractValue")}
        >
          <input
            id="contractValue"
            name="contractValue"
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
            inputMode="decimal"
            className={`${inputClass} max-w-44 text-right font-mono tabular-nums`}
          />
        </Field>

        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rule bg-wash/40">
                <th className="px-3 py-2.5 text-left"><span className="eyebrow">Cost account</span></th>
                <th className="px-2 py-2.5 text-left"><span className="eyebrow">Label</span></th>
                <th className="px-2 py-2.5 text-left"><span className="eyebrow">Note</span></th>
                <th className="w-32 px-2 py-2.5 text-right"><span className="eyebrow">Budget</span></th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row, i) => (
                <tr key={row.key}>
                  <td className="px-2 py-1.5">
                    <select
                      name="budgetAccount"
                      value={row.account}
                      onChange={(e) => set(row.key, "account", e.target.value)}
                      className={`${cell} text-[12px]`}
                    >
                      <option value="">Choose</option>
                      {options.costAccounts.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      name="budgetLabel"
                      value={row.label}
                      onChange={(e) => set(row.key, "label", e.target.value)}
                      placeholder="e.g. Subcontractor A"
                      className={cell}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      name="budgetNote"
                      value={row.note}
                      onChange={(e) => set(row.key, "note", e.target.value)}
                      placeholder="Optional"
                      className={cell}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      name="budgetAmount"
                      value={row.amount}
                      onChange={(e) => set(row.key, "amount", e.target.value)}
                      inputMode="decimal"
                      className={numCell}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== row.key)))
                      }
                      disabled={rows.length === 1}
                      aria-label={`Remove budget line ${i + 1}`}
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
              Add budget line
            </button>

            <div className="w-64">
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-muted">Budgeted cost</span>
                <span className="figure">${budgetedCost.toFixed(2)}</span>
              </div>
              {contract.greaterThan(0) ? (
                <div className="flex justify-between border-t border-rule py-1.5 text-[13px] font-semibold">
                  <span>Budgeted margin</span>
                  <span className="figure !text-[15px]">
                    ${budgetedMargin.toFixed(2)}
                    {marginPercent ? (
                      <span className="ml-1.5 text-[11px] font-normal text-muted">
                        {marginPercent.toFixed(1)}%
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {err("budgets") ? <p className="text-[12px] text-negative">{err("budgets")}</p> : null}
        {rows.map((_, i) =>
          err(`budget-${i}`) ? (
            <p key={i} className="text-[12px] text-negative">
              Line {i + 1}: {err(`budget-${i}`)}
            </p>
          ) : null,
        )}
      </Section>

      <Section title="Notes">
        <Field label="Notes" htmlFor="notes">
          <textarea id="notes" name="notes" rows={2} defaultValue={values?.notes} className={inputClass} />
        </Field>
      </Section>

      <div className="flex items-center gap-3 py-1">
        <SubmitButton label={values ? "Save project" : "Create project"} />
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
