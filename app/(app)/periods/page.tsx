import { Lock, LockOpen, ShieldCheck, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { lockHistory } from "@/lib/ledger/periodLock";
import { longDate, shortDate } from "@/lib/format";
import { setSoftLockAction, releaseSoftLockAction, setHardLockAction } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-rule bg-surface px-2.5 py-1.5 text-[13px] " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const ACTION_LABEL: Record<string, string> = {
  SOFT_LOCK_SET: "Closed",
  SOFT_LOCK_RELEASED: "Reopened",
  HARD_LOCK_SET: "Filed",
  SOFT_LOCK_OVERRIDE: "Override",
};

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const [profile, history] = await Promise.all([
    prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } }),
    lockHistory(20),
  ]);

  const soft = profile.softLockThrough;
  const hard = profile.hardLockThrough;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <p className="eyebrow">General ledger</p>
      <h1 className="page-title mt-1.5">Periods</h1>
      <p className="mt-2 text-[14px] text-muted">
        Closing a period stops entries being dated into it. Filing one makes that permanent.
      </p>

      {error ? (
        <div className="card mt-5 border-negative bg-tint-amber/40 px-5 py-3.5">
          <p className="text-[13px] text-negative">{error}</p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="card px-5 py-4.5">
          <span className="tile bg-tint-amber text-icon-amber">
            <Lock size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="eyebrow mt-3.5">Closed through</p>
          <p className="kpi mt-1">{soft ? shortDate(soft) : "Open"}</p>
          <p className="mt-1 text-[12px] text-faint">
            {soft ? "Entries on or before this date are blocked." : "Nothing is closed."}
          </p>
        </div>

        <div className="card px-5 py-4.5">
          <span className="tile bg-tint-blue text-icon-blue">
            <ShieldCheck size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <p className="eyebrow mt-3.5">Filed through</p>
          <p className="kpi mt-1">{hard ? shortDate(hard) : "None"}</p>
          <p className="mt-1 text-[12px] text-faint">
            {hard ? "Permanently frozen. Cannot be reopened." : "Nothing has been filed."}
          </p>
        </div>
      </div>

      <div className="card mt-4 px-6 py-5">
        <p className="text-[15px] font-semibold tracking-tight">Close a period</p>
        <p className="mt-1 text-[13px] text-muted">
          Do this once a month is reconciled. It can be reopened with a reason.
        </p>
        <form action={setSoftLockAction} className="mt-4 grid grid-cols-4 gap-3">
          <div>
            <label htmlFor="s-through" className="eyebrow">Through</label>
            <input id="s-through" name="through" type="date" defaultValue={today} className={`${input} mt-1`} />
          </div>
          <div className="col-span-2">
            <label htmlFor="s-reason" className="eyebrow">Reason</label>
            <input id="s-reason" name="reason" placeholder="August reconciled" className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor="s-who" className="eyebrow">By</label>
            <input id="s-who" name="performedBy" defaultValue="pabloamaya" className={`${input} mt-1`} />
          </div>
          <div className="col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#1731c9]"
            >
              Close period
            </button>
          </div>
        </form>
      </div>

      {soft ? (
        <div className="card mt-4 px-6 py-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <LockOpen size={15} strokeWidth={2} aria-hidden className="text-icon-amber" />
            Reopen
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Move the closing date earlier, or clear it entirely. Logged with your reason.
          </p>
          <form action={releaseSoftLockAction} className="mt-4 grid grid-cols-4 gap-3">
            <div>
              <label htmlFor="r-to" className="eyebrow">Back to</label>
              <input
                id="r-to"
                name="to"
                type="date"
                defaultValue={hard ? hard.toISOString().slice(0, 10) : ""}
                className={`${input} mt-1`}
              />
              <p className="mt-1 text-[11px] text-faint">
                {hard ? "Cannot go before the filed date." : "Leave blank to open everything."}
              </p>
            </div>
            <div className="col-span-2">
              <label htmlFor="r-reason" className="eyebrow">Reason</label>
              <input
                id="r-reason"
                name="reason"
                placeholder="Late supplier invoice for August"
                className={`${input} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="r-who" className="eyebrow">By</label>
              <input id="r-who" name="performedBy" defaultValue="pabloamaya" className={`${input} mt-1`} />
            </div>
            <div className="col-span-4">
              <button
                type="submit"
                className="rounded-lg border border-rule px-4 py-2 text-[13px] font-medium transition-colors hover:bg-wash/60"
              >
                Reopen period
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card mt-4 border-tint-amber px-6 py-5">
        <p className="text-[15px] font-semibold tracking-tight">File a period</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Do this only after submitting a return to CRA. Filed periods can never be reopened —
          there is no function in this system that undoes it. Corrections after filing must be
          dated in the current period.
        </p>
        <form action={setHardLockAction} className="mt-4 grid grid-cols-4 gap-3">
          <div>
            <label htmlFor="h-through" className="eyebrow">Through</label>
            <input id="h-through" name="through" type="date" className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor="h-reason" className="eyebrow">Reason</label>
            <input id="h-reason" name="reason" placeholder="HST return filed" className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor="h-who" className="eyebrow">By</label>
            <input id="h-who" name="performedBy" defaultValue="pabloamaya" className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor="h-confirm" className="eyebrow">Type FILED</label>
            <input id="h-confirm" name="confirm" placeholder="FILED" className={`${input} mt-1 font-mono`} />
          </div>
          <div className="col-span-4">
            <button
              type="submit"
              className="rounded-lg border border-negative px-4 py-2 text-[13px] font-medium text-negative transition-colors hover:bg-tint-amber/40"
            >
              File period permanently
            </button>
          </div>
        </form>
      </div>

      {history.length > 0 ? (
        <div className="card mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-rule px-5 py-3">
            <History size={14} strokeWidth={2} aria-hidden className="text-faint" />
            <span className="eyebrow">Audit log</span>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-rule">
              {history.map((event) => (
                <tr key={event.id}>
                  <td className="w-24 px-5 py-2.5 text-[12px] font-medium">
                    {ACTION_LABEL[event.action] ?? event.action}
                  </td>
                  <td className="w-40 px-3 py-2.5 font-mono text-[12px] text-muted">
                    {event.newDate ? shortDate(event.newDate) : "cleared"}
                    {event.entryDate ? ` · entry ${shortDate(event.entryDate)}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-muted">{event.reason}</td>
                  <td className="w-28 px-3 py-2.5 text-[12px] text-faint">{event.performedBy}</td>
                  <td className="w-32 px-5 py-2.5 text-right text-[12px] text-faint">
                    {longDate(event.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
