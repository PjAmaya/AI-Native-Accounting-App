import { createHash } from "node:crypto";
import { prisma } from "../db";
import { storeFile } from "../storage";
import { buildFileName, splitExtension } from "./filename";
import type { AttachmentKind } from "@/lib/generated/prisma/enums";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type StoreAttachmentInput = {
  file: File;
  kind: AttachmentKind;
  description?: string | null;
  documentDate: Date;
  contactName: string | null;
  documentLabel: string;
  projectId?: string;
  billId?: string;
  supplierCreditId?: string;
  uploadedBy?: string | null;
};

export async function storeAttachment(input: StoreAttachmentInput) {
  const { file } = input;

  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!ALLOWED.has(file.type)) {
    throw new Error(`${file.type || "That file type"} is not accepted. Use PDF, an image, or an Office document.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { extension } = splitExtension(file.name);

  const parent = input.projectId ?? input.billId ?? input.supplierCreditId;
  if (!parent) throw new Error("An attachment must belong to a project, bill or supplier credit.");

  const existing = await prisma.attachment.findFirst({
    where: {
      sha256,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.billId ? { billId: input.billId } : {}),
      ...(input.supplierCreditId ? { supplierCreditId: input.supplierCreditId } : {}),
    },
  });
  if (existing) {
    throw new Error(`That exact file is already attached as "${existing.fileName}".`);
  }

  const fileName = buildFileName({
    date: input.documentDate,
    contactName: input.contactName,
    document: input.documentLabel,
    originalFileName: file.name,
  });

  const storagePath = `attachments/${sha256.slice(0, 2)}/${sha256}${extension ? `.${extension}` : ""}`;
  await storeFile(storagePath, bytes);

  return prisma.attachment.create({
    data: {
      kind: input.kind,
      fileName,
      mimeType: file.type,
      byteSize: file.size,
      storagePath,
      sha256,
      description: input.description ?? null,
      uploadedBy: input.uploadedBy ?? null,
      projectId: input.projectId ?? null,
      billId: input.billId ?? null,
      supplierCreditId: input.supplierCreditId ?? null,
    },
  });
}

export async function deleteAttachment(attachmentId: string) {
  return prisma.attachment.delete({ where: { id: attachmentId } });
}
