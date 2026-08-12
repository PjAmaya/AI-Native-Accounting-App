# Story Craft Studio — Books

A double-entry accounting and ERP application built for a consulting business, designed as both a working system and a portfolio piece demonstrating operations and finance leadership.

## What It Does

Full-cycle accounts receivable and payable with an AI assistant that reads your books and creates drafts.

**Ledger engine** — Separate debit/credit columns with database constraints. Posted entries are never edited, only reversed. Trial balance, period locking (soft close + permanent filing), and full audit trail.

**Accounts receivable** — Invoices with PDF generation, credit notes with apply-or-refund resolution, payment recording with split applications, and Gmail draft creation for sending.

**Accounts payable** — Bills with tax variance checking and duplicate detection, supplier credits with the same lifecycle as AR credit notes, and PDF-to-bill extraction via Gemini.

**Financial statements** — P&L with EBITDA and five ratios, balance sheet with current-period earnings bridge, direct and indirect cash flow, and AR/AP aging with subledger-to-GL tie checking.

**Project budgets** — Contract value, cost budget by account, budget-versus-actual with margin variance, and collected-to-date tracking. One project per invoice, enforced structurally.

**AI assistant** — Gemini-powered chat with eight read tools and five write tools. Creates draft invoices, bills, and contacts. Cannot issue, post, or pay anything — drafts are the human gate.

**Google integration** — Drive sync for project documents (service agreements, milestones) and financial documents (invoice PDFs). Gmail draft creation for invoice delivery. OAuth with `drive.file` scope — the app can only touch files it created.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · PostgreSQL 18 · Prisma 7 · decimal.js · Puppeteer (PDF) · Gemini 3.5 Flash Lite

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd accounting-app
npm install

# Configure
cp .env.example .env
# Edit .env with your database URL, Gemini key, and Google OAuth credentials

# Database
createdb accounting_app
npx prisma migrate deploy
npx prisma db seed

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Google Drive & Gmail (optional)

1. Create a Google Cloud project and enable Drive API + Gmail API
2. Configure an OAuth consent screen (External, test mode)
3. Create OAuth credentials (Web application) with redirect URI `http://localhost:3000/api/auth/google/callback`
4. Add the credentials to `.env`
5. Go to Settings → Connect Google and authorize with the account that owns the target Drive

See [SECURITY.md](SECURITY.md) for scope details.

## Design Decisions

- **Separate debit/credit columns** rather than signed amounts — a sign error in a signed schema is silent
- **Immutable posted entries** — corrections are reversals, never edits
- **Derived statuses** — OVERDUE and PARTIAL are computed at render, never stored, so they can't drift
- **One project per invoice** — enforced by removing the per-line dropdown, so margin is exact rather than apportioned
- **AI writes produce drafts only** — the draft is the human gate, not a confirmation dialog
- **Two Drive roots** — shared Projects tree and private Financial tree, because Drive sharing inherits downward
- **Provider-swappable AI** — one interface, opaque providerData for provider-specific state

## Limitations

- **No authentication** — single-user, local operation only. `performedBy` is a string, not a verified identity.
- **Document numbering uses max+1** — not concurrency-safe for multi-user access.
- **No bank reconciliation** — statement import and matching are not yet built.
- **No payroll** — the provider handles it; import the journal entry.

## License

Private. Not open source.
