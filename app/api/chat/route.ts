import { NextResponse } from "next/server";
import { runChat } from "@/lib/ai/chat";
import type { ChatMessage } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let question = "";
  let pdfContext = "";
  const history: ChatMessage[] = [];

  if (contentType.includes("multipart/form-data")) {
    const fd = await request.formData();
    question = ((fd.get("question") as string) ?? "").trim();
    const file = fd.get("file");
    if (file instanceof File && file.size > 0 && file.type === "application/pdf") {
      const { extractBillFromPdf } = await import("@/lib/ai/extractBill");
      const bytes = Buffer.from(await file.arrayBuffer());
      try {
        const extracted = await extractBillFromPdf(bytes);
        pdfContext = "\nThe user uploaded a PDF. Extracted data:\n" +
          JSON.stringify(extracted, null, 2) +
          "\nUse create_bill_draft if asked. Vendor: " +
          (extracted.vendorName ?? "unknown") + ", their ref: " +
          (extracted.supplierInvoiceNumber ?? "unknown") + ".";
      } catch (e) {
        pdfContext = "\nPDF extraction failed: " + (e as Error).message;
      }
    }
  } else {
    let body: { question?: unknown; history?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Expected JSON or FormData." }, { status: 400 });
    }
    question = typeof body.question === "string" ? body.question.trim() : "";
    if (Array.isArray(body.history)) history.push(...(body.history as ChatMessage[]));
  }

  if (!question) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "That question is too long." }, { status: 400 });
  }


  try {
    const result = await runChat(question + pdfContext, history.slice(-12));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
