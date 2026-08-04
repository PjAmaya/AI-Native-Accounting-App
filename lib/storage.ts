import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "storage";

export function storagePath(relativePath: string) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), STORAGE_ROOT, relativePath);
}

export async function storeFile(relativePath: string, bytes: Buffer) {
  const absolute = storagePath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  return {
    path: path.posix.join(STORAGE_ROOT, relativePath),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

export async function readStoredFile(storedPath: string) {
  return readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath));
}

export async function verifyStoredFile(storedPath: string, expectedSha256: string) {
  try {
    const bytes = await readStoredFile(storedPath);
    const actual = createHash("sha256").update(bytes).digest("hex");
    return { exists: true, matches: actual === expectedSha256, actual };
  } catch {
    return { exists: false, matches: false, actual: null };
  }
}
