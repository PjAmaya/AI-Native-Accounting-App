# Project Overview: Consulting Firm Accounting & ERP System

## Tech Stack
- **Framework:** Next.js (App Router, TypeScript)
- **UI:** Tailwind CSS, Lucide React Icons, Shadcn/UI
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Precision Math:** `decimal.js` for all currency calculations

## Non-Negotiable Financial & Business Rules
1. **Precision:** NEVER use standard JavaScript numbers (`float`/`double`) for monetary amounts. Always store amounts in Postgres as `Decimal(12, 2)` and process them using `decimal.js`.
2. **Double-Entry Accounting:** Every financial transaction must record balanced debit and credit entries (`sum(debits) == sum(credits)`).
3. **Multi-Currency Readiness:** Every transaction table must include `currency` (default "CAD") and `exchangeRate` (default `1.0`) fields to support future USD/EUR entries.
4. **Accrual vs. Cash:** Revenue/Expense is recognized upon Invoice/Bill issuance (Accrual). Payments against Invoices/Bills record Cash movements for Cash Flow reporting.
5. **Project Tracking:** Invoices and Bills line-items must allow optional linking to `projectId` for margin analysis.

## Code Style & Architecture
- Write clean, modular TypeScript code with strict typing.
- Prefer Server Actions for database writes and Next.js App Router API endpoints for data fetching where applicable.
- Design components using standard Shadcn/UI patterns for high readability and keyboard accessibility.