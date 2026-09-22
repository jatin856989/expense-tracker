# Expense Tracker

A full-featured personal finance tracker: cards, bank accounts, daily expenses,
investment portfolio, loans (lent & borrowed), budgets, recurring bills, and
monthly reports with interactive charts and Excel/PDF export.

The database is Postgres, hosted for free on Neon — private to you, never
shared, and the same one free tier that lets this run on Vercel for $0. See
`DEPLOYMENT.md` to put it online.

## Stack

- **Next.js 16** (App Router, Server Actions, Turbopack)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives)
- **Prisma 7** + **Postgres** (via Neon's serverless driver adapter)
- **Recharts** for interactive charts, **Framer Motion** for animations
- **ExcelJS** and **jsPDF** for report export

## Getting started

1. Create a free Postgres database at [neon.tech](https://neon.tech) (or via
   Vercel's Storage tab — see `DEPLOYMENT.md`) and copy its connection
   string into `.env` as `DATABASE_URL`.
2. Then:

```bash
npm install
npm run db:push     # create the schema in your database
npm run db:seed      # add a starter set of categories
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Modules

- **Dashboard** (`/`) — net worth, this month's cash flow, category
  breakdown, upcoming dues, recent transactions, account balances.
- **Transactions** (`/transactions`) — expenses, income and transfers, with
  search/filter by type, category and date range. Every transaction can
  carry a payment mode (cash/online/card/UPI/etc.), a linked card, a linked
  account, tags and notes.
- **Cards** (`/cards`) — credit, debit, prepaid or other cards. Credit cards
  track a limit and show monthly utilization.
- **Bank Accounts** (`/accounts`) — savings, salary, current, demat or other
  accounts, with a running balance computed from linked transactions.
- **Portfolio** (`/portfolio`) — stocks, mutual funds, crypto, gold, FDs,
  real estate, bonds, PPF/EPF and more. Log a current-value update any time
  to track gain/loss and see the value trend on a chart.
- **Loans** (`/loans`) — money you've lent or borrowed, with partial
  repayment tracking and automatic status (pending / partially settled /
  settled).
- **Budgets** (`/budgets`) — a monthly spending limit per category, with a
  live progress bar against actual spend.
- **Recurring** (`/recurring`) — bills, subscriptions and EMIs. "Mark Paid"
  logs a real transaction and rolls the due date forward automatically.
- **Categories** (`/categories`) — fully dynamic, user-defined, with icon
  and color, shared across expenses, income, investments and loans.
- **Reports** (`/reports`) — month-by-month view across every module, with
  one-click **Export Excel** (multi-sheet workbook: transactions, summary,
  category breakdown, cards, accounts, portfolio, loans, budgets) and
  **Download PDF Slip** (a one-page monthly summary).

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run db:push` | Sync the schema (run after editing `prisma/schema.prisma`) |
| `npm run db:seed` | Re-seed the default categories (safe to re-run — it upserts) |
| `npm run db:studio` | Open Prisma Studio to browse/edit the database directly |

## Project notes

- To start completely fresh, drop all tables in your Neon database (its SQL
  editor has a one-click "reset" per branch) and re-run `db:push` + `db:seed`.
- Categories, cards and accounts can be freely renamed, recolored or deleted
  — deleting one only unlinks it from past transactions, it never deletes
  your transaction history.
- The Excel/PDF export buttons always pull the latest data at click time,
  not a stale snapshot from when the page loaded.
