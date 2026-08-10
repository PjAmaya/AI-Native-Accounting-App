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
  isActive: boolean;
  startDate: string;
  endDate: string;
  notes: string;
  contractValue: string;
  budgets: { account: string; amount: string; note: string }[];
};

type Row = { key: number; account: string; amount: string; note: string };

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, account: "", amount: "", note: "" });

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
              defaultValue={values?.code}
              className={`${inputClass} font-mono`}
              required
            />
          </Field>
          <div className="col-span-3">
            <Field label="Name" htmlFor="name" error={err("name")}>
              <input id="name" name="name" defaultValue={values?.name} className={inputClass} required />
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

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rule px-3.5 py-3 hover:bg-wash/40">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={values ? values.isActive : true}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b3be8]"
          />
          <span>
            <span className="block text-[13px] font-medium">Active</span>
            <span className="mt-0.5 block text-[12px] text-faint">
              Inactive projects stay in reports but leave the dropdowns.
            </span>
          </span>
        </label>
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
