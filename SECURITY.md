# Security

## Authentication

This application has **no authentication layer**. It is designed for single-user, local operation. Anyone with network access to the running instance has full read/write access to the ledger.

The `performedBy` field on period lock events is a string the user supplies — it is an honest record of what was typed, not a verified identity.

**Do not expose this application to the public internet.**

## Google OAuth

The application requests two scopes:

- `drive.file` — access **only** to files the application itself creates. It cannot read, list, or modify any other file in the connected Google Drive.
- `gmail.compose` — creates **draft** emails only. It cannot read existing email or send without the user opening Gmail and pressing Send.

Refresh tokens are stored in the database (`OrgProfile.googleRefreshToken`). Protect database access accordingly.

## File Storage

Uploaded files are stored locally in content-addressed storage (`storage/attachments/`). Files are validated by MIME type whitelist and size limit (20 MB). No image processing is performed — files are stored as opaque bytes and served with their original MIME type.

The SHA-256 hash is computed on upload and stored for integrity verification and duplicate detection.

## AI / LLM

The Gemini API key is stored in `.env` and sent to Google's API. Invoice and bill data is sent to the model for:

- Chat-based queries about the ledger (read-only tools)
- Creating draft invoices and bills (write tools produce drafts only — nothing is posted)
- Extracting bill data from uploaded PDFs

The AI cannot issue, approve, post, void, pay, or delete anything. All write operations produce drafts that require explicit user action.

## Dependencies

Run `npm audit` for current vulnerability status. Known accepted risks:

- `puppeteer` bundles Chromium for PDF generation. It runs locally and is not exposed to untrusted input.
