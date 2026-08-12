# Financial Operating System (FOS) — AI-Powered Accounting Engine

**Built by Pablo Amaya Rojas** — Operations & Finance professional  
[LinkedIn](https://www.linkedin.com/in/pablo-amaya-281a6359/) | [Email-to-Task AI Agent (companion project)](https://github.com/PjAmaya/Email-to-task-Agent)

## What This Is

A production-grade, double-entry accounting system built to run a real consulting business (Story Craft Studio). Not a tutorial project — this handles live AP/AR, generates real invoices, enforces real financial controls, and uses AI to eliminate manual document processing.

I built this because I manage the financial operations for amy wife's consulting firm and the off-the-shelf tools didn't fit. So I built the tool myself — the same way I've built financial and operational systems throughout my career.

## What It Demonstrates

| Skill | How It Shows Up |
|---|---|
| **Financial modeling & accounting** | Full double-entry GL, trial balance, P&L with EBITDA, balance sheet with earnings bridge, cash flow (direct & indirect), AR/AP aging |
| **AP/AR operations** | Complete invoice lifecycle, payment allocation, credit notes, overdue tracking, vendor bill processing |
| **Project economics** | Budget vs. actual tracking, margin attribution, contract value monitoring, cost-center discipline |
| **AI-enabled automation** | Gemini-powered bill parsing (PDF → structured data), AI operations assistant with read/write tools, automated invoice drafting and client delivery |
| **Financial controls** | Immutable ledger (reversals only, no destructive edits), period locking, duplicate-bill detection, tax variance checks, human-in-the-loop approval on all AI outputs |
| **Process automation** | Automated PDF generation, Google Drive filing, Gmail draft preparation — 5–10 minutes saved per transaction cycle |
| **Systems design** | PostgreSQL, Next.js, TypeScript, Prisma ORM, decimal-precision math, Google Workspace integration |

## How It Works

### General Ledger
Double-entry engine with separate debit/credit columns (prevents sign errors), period locking for close cycles, and real-time trial balance reconciliation against AR/AP subledgers.

### Accounts Receivable
Automated invoice lifecycle: create → PDF generation (Puppeteer) → Google Drive filing → Gmail draft with attachments. Supports split payments, partial applications, credit notes, and aging analysis (Current/30/60/90+).

### Accounts Payable + AI Ingestion
Upload a vendor bill PDF → Gemini extracts vendor, line items, totals, and payment terms into a draft record. Built-in duplicate detection and tax variance checks before any posting. All AI outputs require human approval before they hit the ledger.

### Financial Statements
Dynamic P&L (with EBITDA and 5 operational ratios), balance sheet with automated current-period earnings bridge, and cash flow statements (direct and indirect methods) — all calculated from the GL in real time.

### Project Economics
One-project-per-invoice enforcement at the database level. Tracks contract value, cost budget by account, real-time margin variance, and cash collected. No arbitrary cost allocation.

### AI Operations Assistant
Context-aware chat assistant (Gemini) with 8 read tools and 5 write tools. Queries GL balances, inspects project margins, drafts invoices/bills, and builds vendor profiles — all in draft-only mode requiring human sign-off.

## Security & Governance
- **Immutable audit trail** — no record deletion or in-place edits; corrections via reversals only
- **Google OAuth with least-privilege scoping** — app can only access files it created
- **Segregated storage** — financial documents separated from shared project assets
- **Draft-only AI protocol** — AI generates proposals; humans authorize postings

## Tech Stack
Next.js (App Router) + TypeScript, PostgreSQL + Prisma ORM, Tailwind CSS, Puppeteer (PDF), decimal.js (currency precision), Gemini API (document parsing + assistant)

## Roadmap
- [ ] Role-based access control (Finance Manager / Ops Associate / Auditor)
- [ ] Automated bank reconciliation via Open Banking / Plaid
- [ ] Payroll journal-entry ingestion (Gusto, ADP, Rippling)

## About This Project
Built by an operations and finance professional — not a software engineer — to solve a real business problem. The financial architecture (double-entry GL, controls, period management, statement generation) reflects genuine accounting and operational knowledge. The AI integration reflects a practical, controls-first approach: automation that respects the integrity of the financial data it touches.

This is the second AI project in my portfolio. The first — an [Email-to-Task AI Agent](https://github.com/PjAmaya/Email-to-task-Agent) — automates inbox triage into prioritized daily tasks.