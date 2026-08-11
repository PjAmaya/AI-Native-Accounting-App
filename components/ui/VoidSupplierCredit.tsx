"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Ban, X } from "lucide-react";
import { voidSupplierCreditAction } from "@/app/(app)/supplier-credits/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-negative px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Voiding..." : "Void this credit"}
    </button>
  );
}

export function VoidSupplierCredit({
  creditId,
  creditNumber,
  appliedCount,
}: {
  creditId: string;
  creditNumber: number;
  appliedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const action = voidSupplierCreditAction.bind(null, creditId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rule px-3.5 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
      >
        <Ban size={14} strokeWidth={2} aria-hidden />
        Void
      </button>
    );
  }

  return (
    <div className="card w-96 border-tint-amber bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold">Void credit #{creditNumber}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="text-faint hover:text-ink"
        >
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <p className="mt-1.5 text-[12px] leading-snug text-muted">
        The journal entry is reversed and the credit leaves payables.
        {appliedCount > 0
          ? ` It is applied to ${appliedCount} bill${appliedCount === 1 ? "" : "s"}, which will owe money again.`
          : ""}{" "}
        This cannot be undone.
      </p>

      <form action={action} className="mt-3">
        <label htmlFor="reason" className="eyebrow">Reason</label>
        <input
          id="reason"
          name="reason"
          required
          autoFocus
          placeholder="Vendor issued it in error"
          className="mt-1 w-full rounded-lg border border-rule bg-surface px-3 py-2 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
        <div className="mt-3 flex justify-end">
          <ConfirmButton />
        </div>
      </form>
    </div>
  );
}
