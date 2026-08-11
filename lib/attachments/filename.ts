const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitizeSegment(value: string) {
  return value
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80)
    .trim();
}

export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function splitExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return { stem: fileName, extension: "" };
  return {
    stem: fileName.slice(0, dot),
    extension: fileName.slice(dot + 1).toLowerCase().replace(ILLEGAL, ""),
  };
}

export type FileNameParts = {
  date: Date;
  contactName: string | null;
  document: string;
  originalFileName: string;
};

export function buildFileName({
  date,
  contactName,
  document,
  originalFileName,
}: FileNameParts) {
  const { extension } = splitExtension(originalFileName);

  const segments = [
    isoDay(date),
    sanitizeSegment(contactName ?? "No client"),
    sanitizeSegment(document),
  ].filter((s) => s.length > 0);

  const base = segments.join("_");
  return extension ? `${base}.${extension}` : base;
}
