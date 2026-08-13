# Financial Operating System (FOS) — AI-Powered Accounting Engine

**Built by Pablo Amaya Rojas** — Operations & Finance Professional  
[LinkedIn](https://www.linkedin.com/in/pablo-amaya-281a6359/) | [Email-to-Task AI Agent (companion project)](https://github.com/PjAmaya/Email-to-task-Agent)

---

## What This Is

A production-grade, double-entry accounting system I built to run a real consulting business. Not a tutorial — this handles live AP/AR, generates real invoices, enforces real financial controls, and uses AI to eliminate manual document processing.

I manage the financial operations for my wife's consulting firm and the off-the-shelf tools didn't fit. So I built one — the same way I've built financial and operational systems throughout my career.

**Key result:** 5–10 minutes saved per transaction cycle by automating invoice drafting, PDF generation, Google Drive filing, and client communication.

---

## What It Demonstrates

| Skill | How It Shows Up |
|---|---|
| **Double-entry accounting** | Full GL with trial balance, P&L (with EBITDA + 5 operational ratios), balance sheet with earnings bridge, cash flow (direct & indirect methods), AR/AP aging buckets |
| **AP/AR operations** | Complete invoice and bill lifecycles, split payments, partial applications, credit notes, supplier credits with apply-or-refund resolution, overdue tracking |
| **Project economics** | Budget vs. actual, margin attribution, contract value monitoring — enforced one-project-per-invoice at the database level to eliminate arbitrary cost allocation |
| **AI automation (practical, not theoretical)** | Gemini-powered bill parsing (drop a PDF on the form or into the AI chat → structured draft record), AI operations assistant with 13 tools, automated invoice drafting and client delivery |
| **Financial controls** | Immutable ledger (reversals only — zero destructive edits), period locking, duplicate-bill detection, tax variance checks, human-in-the-loop approval on every AI output |
| **Process design** | Automated PDF generation (Puppeteer), Google Drive filing, Gmail draft preparation with payment instructions — end-to-end workflow with no manual handoffs |
| **Systems thinking** | PostgreSQL, Next.js, TypeScript, Prisma ORM, decimal-precision currency math, Google Workspace integration, installable PWA, bookmarkable filtered views |

---

## How It Works

### General Ledger
Double-entry engine with separate debit/credit columns (structurally prevents sign errors), period locking for close cycles, and real-time trial balance reconciliation against AR/AP subledgers. Corrections via reversals only — the ledger is immutable by design.

### Accounts Receivable
Automated invoice lifecycle: create → PDF generation → Google Drive filing → Gmail draft with invoice details and payment instructions. Supports split payments, partial applications, credit notes with full resolution tracking, and aging analysis (Current / 30 / 60 / 90+).

### Accounts Payable + AI Ingestion
Upload a vendor bill PDF — either on the bill form or by dropping it into the AI chat — and Gemini extracts vendor, line items, totals, and tax into a draft record. Built-in duplicate detection and tax variance checks before any posting. All AI outputs require human approval before they hit the ledger. Supplier credits mirror the full AR credit note lifecycle: approve, apply to outstanding bills, or record a vendor refund.

### Financial Statements
Dynamic P&L with EBITDA and 5 operational ratios. Balance sheet with automated current-period earnings bridge (assets always balance). Cash flow statements in both direct and indirect methods. All calculated from the GL in real time — no manual spreadsheet reconciliation.

### Project Economics
One-project-per-invoice enforcement at the database schema level. Tracks contract value, cost budget by chart of accounts, real-time margin variance, and cash collected to date. No arbitrary apportionment across cost centers.

### AI Operations Assistant
Context-aware chat assistant (Gemini) with 8 read tools and 5 write tools. Queries GL balances, inspects project margins, drafts invoices and bills, builds vendor profiles, and ingests vendor bill PDFs directly through the chat panel. Everything operates in draft-only mode — the AI proposes, the human authorizes.

---

## Security & Governance
- **Immutable audit trail** — no record deletion or in-place edits; corrections via reversals only, guaranteeing 100% historical integrity
- **Google OAuth with Drive and Gmail compose scopes** — financial documents stored in a private tree separated from shared project assets
- **Draft-only AI protocol** — AI generates proposals; humans authorize postings. No unsupervised writes to the ledger
- **Installable PWA** — runs as a standalone app on desktop and mobile
- **Bookmarkable filters** — GET-based filtering on every list view for fast, repeatable navigation

---

## Tech Stack
Next.js (App Router) + TypeScript | PostgreSQL + Prisma ORM | Tailwind CSS | Puppeteer (PDF rendering) | decimal.js (currency precision) | Gemini API (document parsing + assistant)

---

## Next Steps
- [ ] Role-based access control (Finance Manager / Ops Associate / Auditor)
- [ ] Automated bank reconciliation via Open Banking / Plaid
- [ ] Payroll journal-entry ingestion (Gusto, ADP, Rippling)

---

## About This Project

Built by an operations and finance professional — not a software engineer — to solve a real business problem. The financial architecture (double-entry GL, controls, period management, statement generation) reflects genuine accounting and operational knowledge. The AI integration reflects a practical, controls-first approach: automation that respects the integrity of the financial data it touches.

This is the second AI-powered project in my portfolio. The first — an [Email-to-Task AI Agent](https://github.com/PjAmaya/Email-to-task-Agent) — automates inbox triage into prioritized daily tasks with idempotency, fault tolerance, and failure-mode testing.

Together, these two projects demonstrate a consistent pattern: identifying where manual work creates drag, designing the automated replacement, and engineering it for reliability — not just building a demo, but shipping something that runs a real operation.