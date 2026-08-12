import Decimal from "decimal.js";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

function env(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set in .env`);
  return value;
}

export type ExtractedLine = {
  description: string;
  amount: string;
  accountCode: string | null;
  confidence: number;
};

export type ExtractedBill = {
  vendorName: string | null;
  supplierInvoiceNumber: string | null;
  billDate: string | null;
  dueDate: string | null;
  subtotal: string | null;
  taxTotal: string | null;
  total: string | null;
  currency: string | null;
  lines: ExtractedLine[];
  confidence: number;
  warnings: string[];
};

const SYSTEM_PROMPT = `You extract invoice/bill data from PDF documents. Return ONLY a JSON object with no markdown fencing, no preamble, no explanation. The JSON must have exactly these fields:

{
  "vendorName": "string or null",
  "supplierInvoiceNumber": "their invoice number as string or null",
  "billDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": "decimal string or null",
  "taxTotal": "decimal string or null",
  "total": "decimal string or null",
  "currency": "three-letter code or null",
  "lines": [
    {
      "description": "string",
      "amount": "decimal string",
      "accountCode": null,
      "confidence": 0.0 to 1.0
    }
  ],
  "confidence": 0.0 to 1.0,
  "warnings": ["string"]
}

Rules:
- All amounts as positive decimal strings with two decimal places
- If you cannot read a field clearly, set it to null and lower the confidence
- Add a warning for anything unusual: tax that doesn't match lines, duplicate line items, unreadable sections
- The confidence score reflects how certain you are the extraction is correct overall
- Do NOT guess account codes — always set accountCode to null
- Do NOT invent line items — only extract what is on the document`;

export async function extractBillFromPdf(pdfBytes: Buffer): Promise<ExtractedBill> {
  const base64 = pdfBytes.toString("base64");
  const model = env("GEMINI_MODEL");

  const response = await fetch(`${API}/${model}:generateContent?key=${env("GEMINI_API_KEY")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: "Extract the invoice data from this PDF." },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini extraction failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");

  const cleaned = text.replace(/```json|```/g, "").trim();

  let parsed: ExtractedBill;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse Gemini response as JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.lines) parsed.lines = [];
  if (!parsed.warnings) parsed.warnings = [];
  if (typeof parsed.confidence !== "number") parsed.confidence = 0.5;

  const lineTotal = parsed.lines.reduce(
    (sum, l) => sum.plus(l.amount || "0"),
    new Decimal(0),
  );

  if (parsed.subtotal) {
    const diff = new Decimal(parsed.subtotal).minus(lineTotal).abs();
    if (diff.greaterThan("0.05")) {
      parsed.warnings.push(
        `Line amounts (${lineTotal.toFixed(2)}) do not sum to subtotal (${parsed.subtotal}). Check for missing lines.`,
      );
    }
  }

  return parsed;
}
