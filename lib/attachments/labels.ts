import type { AttachmentKind } from "@/lib/generated/prisma/enums";

export const KIND_LABEL: Record<AttachmentKind, string> = {
  SERVICE_AGREEMENT: "Service agreement",
  MILESTONE: "Milestone",
  SHARED_DOCUMENT: "Shared document",
  SOURCE_DOCUMENT: "Source document",
  SUPPORTING: "Supporting",
};

export const PROJECT_KINDS: AttachmentKind[] = [
  "SERVICE_AGREEMENT",
  "MILESTONE",
  "SHARED_DOCUMENT",
];

export const DRIVE_SUBFOLDER: Partial<Record<AttachmentKind, string>> = {
  SERVICE_AGREEMENT: "Agreements",
  MILESTONE: "Milestones",
  SHARED_DOCUMENT: "Documents shared",
};
