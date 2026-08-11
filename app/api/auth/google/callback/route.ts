import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?googleError=${encodeURIComponent(error)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?googleError=No+code+received", url.origin));
  }

  try {
    await exchangeCode(code);
  } catch (e) {
    return NextResponse.redirect(
      new URL(`/settings?googleError=${encodeURIComponent((e as Error).message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL("/settings?googleConnected=true", url.origin));
}
