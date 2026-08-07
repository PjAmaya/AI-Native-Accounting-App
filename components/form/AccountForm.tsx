"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock, TriangleAlert } from "lucide-react";
import { saveAccount, type AccountFormState } from "@/app/(app)/accounts/actions";
import { Field, Section, inputClass } from "./fields";

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
type AccountType = (typeof TYPES)[number];

const SUBTYPES: Record<AccountType, { value: string; label: string }[]> = {
  ASSET: [
    { value: "CURRENT_ASSET", label: "Current asset" },
    { value: "FIXED_ASSET", label: "Fixed asset" },
  ],
  LIABILITY: [
    { value: "CURRENT_LIABILITY", label: "Current liability" },
    { value: "LONG_TERM_LIABILITY", label: "Long-term liability" },
  ],
  EQUITY: [{ value: "OWNERS_EQUITY", label: "Owner's equity" }],
  REVENUE: [
    { value: "OPERATING_REVENUE", label: "Operating revenue" },
    { value: "OTHER_INCOME", label: "Other income" },
  ],
  EXPENSE: [
    { value: "COST_OF_SERVICES", label: "Cost of services" },
    { value: "OPERATING_EXPENSE", label: "Operating expense" },
    { value: "OTHER_EXPENSE", label: "Other expense" },
  ],
};

const ADD_BACKS = [
  { value: "NONE", label: "None" },
  { value: "DEPRECIATION", label: "Depreciation" },
  { value: "AMORTIZATION", label: "Amortization" },
  { value: "INTEREST", label: "Interest" },
  { value: "INCOME_TAX", label: "Income tax" },
];

export type AccountValues = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: string;
  normalBalance: "DEBIT" | "CREDIT";
  isPostable: boolean;
  isActive: boolean;
  capitalCandidate: boolean;
  ebitdaAddBack: string;
  parentCode: string;
  postingCount: number;
};

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
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "flex items-start gap-2.5 rounded-lg border border-rule px-3.5 py-3 " +
        (disabled ? "opacity-60" : "cursor-pointer hover:bg-wash/40")
      }
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b3be8]"
      />
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-faint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function AccountForm({
  values,
  parents,
}: {
  values?: AccountValues;
  parents: { value: string; label: string }[];
}) {
  const [state, action] = useActionState<AccountFormState, FormData>(saveAccount, null);
  const err = (key: string) => state?.errors?.[key];

  const [type, setType] = useState<AccountType>(values?.type ?? "EXPENSE");
  const [subType, setSubType] = useState(values?.subType ?? "OPERATING_EXPENSE");

  const locked = (values?.postingCount ?? 0) > 0;

  function changeType(next: AccountType) {
    setType(next);
    setSubType(SUBTYPES[next][0].value);
  }

  return (
    <form action={action} className="grid gap-4">
      {values ? <input type="hidden" name="id" value={values.id} /> : null}
      {state?.pendingName ? (
        <input type="hidden" name="acknowledgedName" value={state.pendingName} />
      ) : null}

      {state?.warnings?.length ? (
        <div className="card border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <p className="eyebrow flex items-center gap-1.5 !text-icon-amber">
            <TriangleAlert size={13} strokeWidth={2.2} aria-hidden />
            Duplicate name
          </p>
          <ul className="mt-1.5 grid gap-1">
            {state.warnings.map((w, i) => (
              <li key={i} className="text-[13px] leading-snug">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {locked ? (
        <div className="card flex items-start gap-2.5 border-tint-amber bg-tint-amber/40 px-5 py-3.5">
          <Lock size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-icon-amber" />
          <p className="text-[13px]">
            This account has {values!.postingCount} posted line
            {values!.postingCount === 1 ? "" : "s"}. Its code, type, sub-type and normal balance are
            locked — changing them would restate every past report.
          </p>
        </div>
      ) : null}

      <Section title="Identity">
        <div className="grid grid-cols-4 gap-4">
          <Field label="Code" htmlFor="code" hint="Four digits" error={err("code")}>
            <input
              id="code"
              name="code"
              defaultValue={values?.code}
              readOnly={locked}
              inputMode="numeric"
              className={`${inputClass} font-mono ${locked ? "bg-wash/60" : ""}`}
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
          <Field label="Type" htmlFor="type" error={err("type")}>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => changeType(e.target.value as AccountType)}
              disabled={locked}
              className={`${inputClass} ${locked ? "bg-wash/60" : ""}`}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {locked ? <input type="hidden" name="type" value={type} /> : null}
          </Field>

          <Field label="Sub-type" htmlFor="subType" error={err("subType")}>
            <select
              id="subType"
              name="subType"
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              disabled={locked}
              className={`${inputClass} ${locked ? "bg-wash/60" : ""}`}
            >
              {SUBTYPES[type].map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {locked ? <input type="hidden" name="subType" value={subType} /> : null}
          </Field>

          <Field
            label="Normal balance"
            htmlFor="normalBalance"
            hint="The side that increases it"
            error={err("normalBalance")}
          >
            <select
              id="normalBalance"
              name="normalBalance"
              defaultValue={values?.normalBalance ?? (type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT")}
              disabled={locked}
              className={`${inputClass} ${locked ? "bg-wash/60" : ""}`}
            >
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
            </select>
            {locked ? (
              <input type="hidden" name="normalBalance" value={values!.normalBalance} />
            ) : null}
          </Field>
        </div>

        <Field
          label="Rolls up into"
          htmlFor="parentCode"
          hint="Optional. Cash accounts must sit under 1000 to appear in cash flow."
          error={err("parentCode")}
        >
          <select
            id="parentCode"
            name="parentCode"
            defaultValue={values?.parentCode ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {parents.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Behaviour">
        <div className="grid grid-cols-2 gap-3">
          <Check
            name="isPostable"
            label="Postable"
            hint="Entries can be recorded against it. Headings are not postable."
            defaultChecked={values ? values.isPostable : true}
            disabled={locked}
          />
          <Check
            name="isActive"
            label="Active"
            hint="Inactive accounts stay in past reports but leave the dropdowns."
            defaultChecked={values ? values.isActive : true}
          />
        </div>
        {err("isPostable") ? (
          <p className="text-[12px] text-negative">{err("isPostable")}</p>
        ) : null}
        {locked ? <input type="hidden" name="isPostable" value="on" /> : null}

        <Check
          name="capitalCandidate"
          label="Capitalization candidate"
          hint="Warn when a bill line to this account is at or above the threshold."
          defaultChecked={values?.capitalCandidate}
        />

        <Field
          label="EBITDA add-back"
          htmlFor="ebitdaAddBack"
          hint="Excluded from EBITDA. Leave as None unless this is depreciation, interest or income tax."
        >
          <select
            id="ebitdaAddBack"
            name="ebitdaAddBack"
            defaultValue={values?.ebitdaAddBack ?? "NONE"}
            className={`${inputClass} max-w-56`}
          >
            {ADD_BACKS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <div className="flex items-center gap-3 py-1">
        <SubmitButton label={values ? "Save account" : "Create account"} />
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
