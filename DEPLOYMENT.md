# Deploying Expense Tracker — Free

**Short answer: yes, effectively just Vercel.** Vercel hosts and runs the
app. It has no persistent disk though (anything an app writes to disk on
Vercel disappears the moment the request finishes), so the database has to
live somewhere else — that's **Neon**, a free hosted Postgres service. You
only touch Neon once during setup (and again if you ever change the data
model); day to day, updating your app just means pushing code and Vercel
redeploys automatically. Both are free forever at this app's scale — no
credit card required for either.

This project is already set up to use Neon (see `README.md`) — the steps
below get you from "runs on my machine" to a live URL.

**✅ Part 1 is already done for this project.** It's linked to Neon project
`weathered-breeze-80300147` (branch `production`) via the Neon CLI, which
wrote a working `DATABASE_URL` straight into `.env`. That section is kept
below for reference (e.g. setting up on a new machine, or starting a
project from scratch without the CLI).

---

## Part 1 — Create your free database (Neon)

**Option A — Neon CLI** (what this project actually used):
```bash
npm i -g neon@latest
neon login                 # opens a browser to authenticate
neon link --project-id <your-project-id> --branch production -y
```
`neon link` pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH`
straight into `.env` — no copy-pasting needed. (`neon skills -y` and
`neon mcp -y` are optional extras that set up Neon's Claude Code/MCP
integration; not required just to deploy.)

**Option B — Neon dashboard** (no CLI, no account-linking):
1. Go to **[neon.tech](https://neon.tech)** and sign up (email or GitHub —
   no credit card needed).
2. Click **Create a project**. Name it `expense-tracker`, pick a region
   close to you, leave everything else default.
3. Neon immediately shows a **connection string** that looks like:
   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Copy the whole thing.
4. Open `E:\ExpenseTracker\.env` and replace the placeholder line with it:
   ```
   DATABASE_URL="postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
   ```

## Part 2 — Set up the schema and confirm it works locally

```bash
cd E:\ExpenseTracker
npm run db:push     # creates all the tables in your Neon database
npm run db:seed     # adds the starter categories
npm run dev
```

Open `http://localhost:3000` — if you see the Dashboard and the Categories
page shows the seeded list, your Neon connection is working. Fix any
connection errors here before moving on (double-check you copied the whole
connection string, including `?sslmode=require`).

## Part 3 — Push your code to GitHub

Vercel's easiest flow imports directly from a GitHub repo and auto-deploys
every time you push. (There's a no-GitHub alternative in Part 5 if you'd
rather skip this.)

1. Create a new **empty** repository at [github.com/new](https://github.com/new)
   — name it `expense-tracker`, keep it **Private**, and don't check any of
   the "initialize with README/.gitignore" boxes (this project already has
   those).
2. In your project folder, connect and push:
   ```bash
   cd E:\ExpenseTracker
   git remote add origin https://github.com/YOUR-USERNAME/expense-tracker.git
   git add -A
   git commit -m "Expense tracker: full app"
   git push -u origin master
   ```
   (Replace `YOUR-USERNAME` with your actual GitHub username. If prompted to
   log in, follow GitHub's device/browser login flow.)

## Part 4 — Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign up — choose
   **"Continue with GitHub"** so it can see your new repo.
2. Click **Add New...** → **Project**.
3. Find `expense-tracker` in the list and click **Import**.
4. Vercel auto-detects Next.js — leave the build settings as-is.
5. Before clicking Deploy, expand **Environment Variables** and add one:
   - **Name:** `DATABASE_URL`
   - **Value:** the same Neon connection string from Part 1
6. Click **Deploy**. It takes about a minute.
7. You'll get a live URL like `https://expense-tracker-yourname.vercel.app`
   — open it and confirm it loads and shows the same data you saw locally
   (it's the same Neon database, so local and live always match).

**That's it — it's live**, reachable from your phone or any browser,
for $0.

## Part 5 — Making changes later

- **Code changes:** just `git push` to `master`. Vercel rebuilds and
  redeploys automatically within a minute or two — no manual redeploy step.
- **Schema changes** (editing `prisma/schema.prisma`): Vercel only deploys
  your *code*, not database migrations. After changing the schema, run
  `npm run db:push` locally once (it's pointed at the same Neon database
  your live site uses) so the database matches what the new code expects.
- **No GitHub alternative:** if you'd rather not use GitHub at all, install
  the Vercel CLI (`npm install -g vercel`, then `vercel login`) and run
  `vercel` from the project folder to deploy directly from your machine,
  and `vercel --prod` to push a production deploy. You'll add the same
  `DATABASE_URL` environment variable from the Vercel dashboard either way.

## Good to know

- **Free tier limits:** Neon's free tier gives 0.5 GB of storage (many
  years of personal transaction data) and auto-suspends the database after
  a period of inactivity — it wakes itself automatically on the next
  request, with about a 1-second delay the first time. Vercel's free
  ("Hobby") plan has generous bandwidth and execution limits that a
  personal app won't come close to.
- **One database for local and live:** by design, your local `npm run dev`
  and your deployed site both point at the same Neon database (same
  `DATABASE_URL`) — so they always show the same data. That's simplest for
  a single personal tracker. If you ever want them separate, create a
  second Neon project and give the deployed site's Vercel environment
  variable a different `DATABASE_URL`.
- **Custom domain:** optional, and not needed to use the app — but if you
  own a domain, Vercel lets you attach it for free under Project → Settings
  → Domains.
- **`neon.ts` / `neon deploy` is not the same thing as `db:push`.** The
  `neon` CLI's config-as-code (`neon.ts`, `neon config apply`/`neon deploy`)
  manages *Neon project settings* — compute size, branches, auth, storage
  buckets, etc. It has nothing to do with your app's actual tables. Table
  schema is entirely Prisma's job: after any change to
  `prisma/schema.prisma`, run `npm run db:push` — `neon deploy` won't do
  this for you, and running it doesn't create or update a single table.
