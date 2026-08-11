import { prisma } from "../db";
import { readStoredFile } from "../storage";
import { createFolder, ensureFolder, uploadFile } from "./drive";
import { DRIVE_SUBFOLDER } from "../attachments/labels";
import type { AttachmentKind } from "@/lib/generated/prisma/enums";

export async function syncAttachmentToDrive(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { project: true, bill: true, supplierCredit: true },
  });

  if (!attachment) throw new Error("Attachment not found.");
  if (attachment.driveFileId) return attachment;

  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });
  if (!profile.googleRefreshToken) throw new Error("Google is not connected.");

  let targetFolderId: string | null = null;

  if (attachment.projectId && attachment.project) {
    if (!profile.driveProjectsRootId) throw new Error("Drive projects folder is not configured.");

    let projectFolderId = attachment.project.driveFolderId;
    if (!projectFolderId) {
      const folder = await createFolder(
        `${attachment.project.code} — ${attachment.project.name}`,
        profile.driveProjectsRootId,
      );
      await prisma.project.update({
        where: { id: attachment.projectId },
        data: { driveFolderId: folder.id, driveFolderUrl: folder.webViewLink },
      });
      projectFolderId = folder.id;
    }

    const subfolder = DRIVE_SUBFOLDER[attachment.kind as AttachmentKind];
    targetFolderId = subfolder
      ? (await ensureFolder(subfolder, projectFolderId)).id
      : projectFolderId;
  } else if (attachment.billId) {
    targetFolderId = profile.driveApBillsId;
  } else if (attachment.supplierCreditId) {
    targetFolderId = profile.driveSupplierCreditsId;
  }

  if (!targetFolderId) throw new Error("No Drive folder configured for this attachment type.");

  const bytes = await readStoredFile(attachment.storagePath);

  try {
    const result = await uploadFile(
      attachment.fileName,
      attachment.mimeType,
      Buffer.from(bytes),
      targetFolderId,
    );

    return prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        driveFileId: result.id,
        driveWebLink: result.webViewLink,
        driveSyncedAt: new Date(),
        driveError: null,
      },
    });
  } catch (e) {
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { driveError: (e as Error).message },
    });
    throw e;
  }
}

export async function syncInvoicePdfToDrive(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { contact: true },
  });
  if (!invoice || !invoice.pdfPath) return null;

  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });
  if (!profile.driveArInvoicesId || !profile.googleRefreshToken) return null;

  const bytes = await readStoredFile(invoice.pdfPath);
  const fileName = `${invoice.invoiceDate.toISOString().slice(0, 10)}_${invoice.contact.name.replace(/[\\/:*?"<>|]/g, " ")}_AR Invoice ${invoice.invoiceNumber}.pdf`;

  const result = await uploadFile(
    fileName,
    "application/pdf",
    Buffer.from(bytes),
    profile.driveArInvoicesId,
  );

  return result;
}
