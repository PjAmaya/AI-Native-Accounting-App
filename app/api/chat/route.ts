import { NextResponse } from "next/server";
import { runChat } from "@/lib/ai/chat";
import type { ChatMessage } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { question?: unknown; history?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "That question is too long." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];

  try {
    const result = await runChat(question, history.slice(-12));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
