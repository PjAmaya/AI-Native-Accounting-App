import { createHash } from "node:crypto";
import type { Browser } from "puppeteer";
import { renderInvoiceHtml } from "./renderInvoice";

export type RenderedPdf = {
  bytes: Buffer;
  sha256: string;
};

let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = (await import("puppeteer")).default;
      return puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
    })();
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

export async function htmlToPdf(html: string): Promise<RenderedPdf> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");

    const bytes = Buffer.from(
      await page.pdf({
        format: "a4",
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );

    return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
  } finally {
    await page.close();
  }
}

export async function renderInvoicePdf(invoiceId: string): Promise<RenderedPdf> {
  const html = await renderInvoiceHtml(invoiceId);
  return htmlToPdf(html);
}
