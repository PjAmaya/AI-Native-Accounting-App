"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setSoftLock, releaseSoftLock, setHardLock } from "@/lib/ledger/periodLock";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function utcDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fail(message: string): never {
  redirect(`/periods?error=${encodeURIComponent(message)}`);
}

export async function setSoftLockAction(formData: FormData) {
  const through = utcDate(text(formData, "through"));
  const reason = text(formData, "reason");
  const who = text(formData, "performedBy");

  if (!through) fail("Choose a date to close through.");
  if (!reason) fail("A reason is required.");
  if (!who) fail("Enter who is doing this.");

  try {
    await setSoftLock(through!, who!, reason!);
  } catch (e) {
    fail((e as Error).message);
  }

  revalidatePath("/periods");
  redirect("/periods");
}

export async function releaseSoftLockAction(formData: FormData) {
  const to = utcDate(text(formData, "to"));
  const reason = text(formData, "reason");
  const who = text(formData, "performedBy");

  if (!reason) fail("A reason is required to reopen a period.");
  if (!who) fail("Enter who is doing this.");

  try {
    await releaseSoftLock(to, who!, reason!);
  } catch (e) {
    fail((e as Error).message);
  }

  revalidatePath("/periods");
  redirect("/periods");
}

export async function setHardLockAction(formData: FormData) {
  const through = utcDate(text(formData, "through"));
  const reason = text(formData, "reason");
  const who = text(formData, "performedBy");
  const confirm = text(formData, "confirm");

  if (!through) fail("Choose a date to file through.");
  if (!reason) fail("A reason is required.");
  if (!who) fail("Enter who is doing this.");
  if (confirm !== "FILED") fail('Type FILED to confirm — a hard lock can never be released.');

  try {
    await setHardLock(through!, who!, reason!);
  } catch (e) {
    fail((e as Error).message);
  }

  revalidatePath("/periods");
  redirect("/periods");
}
