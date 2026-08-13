import { getAccessToken } from "./auth";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function headers() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createFolder(name: string, parentId?: string): Promise<{ id: string; webViewLink: string }> {
  const response = await fetch(`${API}/files?fields=id,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Drive folder creation failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  return response.json();
}

export async function uploadFile(
  name: string,
  mimeType: string,
  bytes: Buffer,
  parentId: string,
): Promise<{ id: string; webViewLink: string }> {
  const metadata = JSON.stringify({ name, parents: [parentId] });

  const boundary = "----StoryCraftBoundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const token = await getAccessToken();
  const response = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Drive upload failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  return response.json();
}

export async function ensureFolder(
  name: string,
  parentId: string,
): Promise<{ id: string; webViewLink: string }> {
  const token = await getAccessToken();
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await fetch(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) throw new Error(`Drive search failed: ${response.status}`);

  const data = (await response.json()) as { files?: { id: string; webViewLink: string }[] };
  if (data.files && data.files.length > 0) return data.files[0];

  return createFolder(name, parentId);
}
