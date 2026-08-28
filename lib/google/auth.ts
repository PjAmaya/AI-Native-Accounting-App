import { prisma } from "../db";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.compose",
].join(" ");

function env(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set in .env`);
  return value;
}

export function authorizationUrl() {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  };

  if (!data.refresh_token) {
    throw new Error(
      "No refresh token received. Revoke the app at myaccount.google.com/permissions and try again.",
    );
  }

  await prisma.orgProfile.update({
    where: { id: "default" },
    data: {
      googleRefreshToken: data.refresh_token,
      googleAccessToken: data.access_token,
      googleTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data;
}

export async function getAccessToken(): Promise<string> {
  const profile = await prisma.orgProfile.findUniqueOrThrow({ where: { id: "default" } });

  if (!profile.googleRefreshToken) {
    throw new Error("Google is not connected. Go to Settings → Connect Google.");
  }

  if (
    profile.googleAccessToken &&
    profile.googleTokenExpiresAt &&
    profile.googleTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return profile.googleAccessToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: profile.googleRefreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Token refresh failed:", response.status, detail);
    if (response.status === 400 || response.status === 401) {
      console.error(
        "The refresh token may have been revoked. Go to Settings → Connect Google to re-authorize.",
      );
    }
    throw new Error(
      `Google token refresh failed (${response.status}). Reconnect in Settings if this persists.`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  await prisma.orgProfile.update({
    where: { id: "default" },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}
