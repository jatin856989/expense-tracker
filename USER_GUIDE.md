# Expense Tracker — User Guide

This is your guide to actually *using* the app day to day. For setup/technical
details, see `README.md`; for putting it online, see `DEPLOYMENT.md`. This
file is about what each screen does and how to work with it.

Start the app with `npm run dev` in the `E:\ExpenseTracker` folder, then open
`http://localhost:3000`. Your data lives in a private Neon Postgres database
that only you have the connection string to — it's never shared or indexed
anywhere.

**You'll land on a sign-in screen first.** The app requires your username
and password before showing anything — set these up once via
`AUTH_SETUP.md` if you haven't already. Sessions last 30 days, and the
sign-out icon is in the top-right corner once you're in.

The left sidebar (or the menu icon on mobile) has every module. Here's what
each one is for.

---

## 1. Dashboard (`/`)

Your home screen — a live snapshot of your whole financial picture.

- **Net Worth** — everything you own (bank balances + cash + investments +
  money owed to you) minus everything you owe (borrowed money).
- **This Month's Expense / Income** — with a percentage comparison to last
  month, so you can see at a glance if you're spending more or less.
- **Investment Value** and **Investment Gain/Loss** — your portfolio's
  current worth and how much it's up or down since you invested.
- **Owed to You / You Owe** — outstanding loan balances.
- **Cash Flow — Last 6 Months** chart — a bar chart of income vs. expense
  by month, so you can spot trends.
- **This Month by Category** — a donut chart showing where this month's
  expenses went.
- **Upcoming Dues** — recurring bills coming up soon, pulled from the
  Recurring module.
- **Recent Transactions** — your last 8 transactions, with a link to see
  all of them.
- **Accounts Overview** — every bank account and its current balance, click
  through to any of them for details.

There's nothing to configure here — it's built entirely from what you enter
in the other modules.

---

## 2. Categories (`/categories`)

The tags that organize everything else. A category has a **name**, an
**icon**, a **color**, and a **type** (Expense, Income, Investment, or Loan)
— transactions only show categories matching their own type, so an "Income"
category won't clutter your expense dropdown.

The app comes pre-loaded with ~37 sensible categories (Groceries, Rent,
Salary, Equity/Stocks, Personal Loan, etc.) so you don't start from a blank
page — but **every one of them can be renamed, recolored, or deleted**.
Deleting a category never deletes your transaction history; it just unlinks
those transactions (they show as "Uncategorized").

**When to use it:** rename or add categories *before* logging transactions
if the defaults don't match how you think about your money — it's much
easier to categorize correctly the first time than to re-tag things later.

---

## 3. Cards (`/cards`)

Every credit, debit, prepaid, or other card you use. Each card is shown as a
visual tile with:

- Bank name, last 4 digits, cardholder name, expiry
- **This month's spend** on that card (calculated automatically from linked
  transactions)
- For **credit cards specifically**: a utilization bar showing what
  percentage of your credit limit you've used this month

Click a card to see its full transaction history and lifetime spend. Cards
are mainly a way to *tag* transactions — when you log an expense, you can
optionally link it to the card you paid with, and this page rolls that up
automatically. Toggle a card **Inactive** instead of deleting it if you stop
using it but want to keep the history.

---

## 4. Bank Accounts (`/accounts`)

Savings, salary, current, demat, or other accounts. Each one tracks a
**running balance**: your opening balance, plus every income transaction
linked to it, minus every expense or outgoing transfer, plus every incoming
transfer.

Click an account to see its full transaction history, plus a breakdown of
total money in vs. total money out. This is the module that gives your
"Bank + Cash Balance" number on the dashboard its meaning — the more
transactions you link to an account, the more accurate that number is.

**Tip:** if you pay cash and don't link a bank account, the app still tracks
it separately as a "cash" balance (visible on the dashboard) — you don't need
an account for every single transaction.

---

## 5. Transactions (`/transactions`)

The core of daily tracking. Every entry is one of three types:

- **Expense** — money going out. Pick a category, a payment mode
  (cash/online/card/UPI/bank transfer/other), and optionally the card and/or
  account it came from.
- **Income** — money coming in. Same fields, but categorized as income
  (Salary, Freelance, Interest, etc.) and optionally credited to an account.
- **Transfer** — moving money between your own two accounts (e.g., savings
  to current). This needs a *from* account and a *to* account, and doesn't
  count as either income or expense in your totals.

Every transaction can have **tags** (comma-separated, e.g. "travel, family")
and free-text **notes** — useful for things you'll want to search for later
("dinner with mom", "annual insurance premium").

The list at the top supports **search** (matches description and notes),
and filters by **type**, **category**, and **date range** — all through the
URL, so you can bookmark a filtered view if you want. Results are paginated
50 at a time.

---

## 6. Portfolio (`/portfolio`)

Every investment: stocks, mutual funds, crypto, fixed deposits, gold, real
estate, bonds, PPF/EPF, or anything else. When you add one, you record:

- **Platform** (Zerodha, Groww, physical, etc.) and **instrument type**
- **Amount invested**, and optionally units and price-per-unit
- **Current value** — if you leave this blank, it defaults to what you
  invested (0% gain/loss) until you update it

The top of the page shows total invested, current value, overall gain/loss,
and an **allocation chart** breaking your portfolio down by instrument type.

**The key workflow:** click into any investment and use **Update Value**
whenever you check its current worth (weekly, monthly, whenever). Each
update is logged, so the investment's detail page builds a **value-over-time
chart** automatically — this is how you get a real gain/loss trend instead
of a single static number.

---

## 7. Loans (`/loans`)

Two independent lists: money you've **lent** (someone owes you) and money
you've **borrowed** (you owe someone). Each loan records the person, amount,
date, an optional due date, and reason/notes.

Click into a loan to **log a repayment** — partial repayments are fully
supported, and the loan's status updates automatically:

- **Pending** — nothing repaid yet
- **Partially Settled** — some but not all repaid
- **Settled** — fully repaid

The loan card shows a progress bar and the outstanding amount at a glance.
Overdue loans (past their due date, not yet settled) are flagged with a red
badge. The dashboard rolls all of this up into "Owed to You" and "You Owe."

---

## 8. Budgets (`/budgets`)

Set a monthly spending limit per expense category. Use the arrows to move
between months — budgets are month-specific, so a limit you set for
September doesn't carry over to October automatically (set it fresh each
month, or just leave last month's for reference).

Each budget shows a progress bar comparing your limit to actual spend in
that category for that month, colored green → amber → red as you approach
and exceed the limit.

**Tip:** only categories without an existing budget for the current month
show up in the "Set Budget" dropdown, so you won't accidentally create
duplicates.

---

## 9. Recurring (`/recurring`)

Bills, subscriptions, and EMIs that repeat on a schedule (daily, weekly,
monthly, quarterly, or yearly). Each item has a name, amount, category,
payment mode, and a **next due date**.

The important button is **Mark Paid**: clicking it does two things at once —
logs a real transaction (so it shows up in your Transactions list and
affects your totals) and rolls the due date forward by one cycle. This means
you don't have to manually re-enter your Netflix subscription or EMI every
month; you just click through it when it's due.

Items due soon (or overdue) surface automatically on the Dashboard under
"Upcoming Dues." Toggle an item **Inactive** to pause it (e.g., a
subscription you've cancelled) without losing its history.

---

## 10. Reports (`/reports`)

Your month-end summary. Use the arrows to pick a month, and you'll see:

- Income, expense, net savings, and savings rate for that month
- A 6-month cash flow chart and that month's category breakdown
- Portfolio value/gain-loss and loan summaries as of *today* (these aren't
  month-specific, since they reflect your current position)

Two export buttons at the top:

- **Export Excel** — downloads a multi-sheet workbook: every transaction
  that month, a summary sheet, category breakdown, cards, accounts,
  portfolio, loans, and budgets (if any are set for that month).
- **Download PDF Slip** — a one-page printable summary: income/expense/net
  savings, expense-by-category table, and outstanding loans.

Both pull fresh data at the moment you click — they're never a stale
snapshot from when you first opened the page.

---

## How the modules connect

- **Categories** are shared across Transactions, Investments, and Loans —
  set them up the way you think, once.
- **Cards and Accounts** are optional tags on a Transaction. You get more
  useful per-card and per-account totals the more consistently you link
  them, but you're never required to.
- **Net worth** (dashboard) = bank + cash balances + investment current
  value + money owed to you − money you owe.
- **Recurring items** become real Transactions the moment you mark them
  paid — they don't silently affect your totals before that.

## A simple monthly routine

1. Log expenses/income as they happen (or in a weekly batch) in
   **Transactions**.
2. Mark any due bills **Paid** in **Recurring**.
3. Update investment values in **Portfolio** if anything's changed.
4. Log any loan repayments in **Loans**.
5. At month-end, check **Budgets** to see where you overspent, and pull your
   **Reports** export for a full month-end summary.
