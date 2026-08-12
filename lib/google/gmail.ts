import { getAccessToken } from "./auth";

const API = "https://gmail.googleapis.com/v1/users/me";

function buildRfc822(to: string, subject: string, htmlBody: string, from?: string) {
  const headers = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody,
  ].join("\r\n");

  return Buffer.from(headers).toString("base64url");
}

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
}): Promise<{ draftId: string; messageId: string }> {
  const raw = buildRfc822(input.to, input.subject, input.htmlBody, input.from);
  const token = await getAccessToken();

  const response = await fetch(`${API}/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail draft creation failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    id: string;
    message: { id: string };
  };

  return { draftId: data.id, messageId: data.message.id };
}
