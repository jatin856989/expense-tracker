# Setting Up the Login Wall

The app now requires signing in — nobody can view or change your data without
a username and password. This needs **three secrets**, which you generate
yourself, in your own terminal, so they never appear anywhere else (not in
this chat, not in any file I can see):

- `AUTH_USERNAME` — whatever username you want, in plain text
- `AUTH_PASSWORD_HASH` — a one-way bcrypt hash of your password (the app
  never stores or compares your actual password, only this hash) —
  **base64-encoded**, see note below
- `AUTH_SECRET` — a random signing key that proves a browser's session
  cookie is genuine. Nothing to remember — just paste it in once and forget it.

> **Why base64?** A raw bcrypt hash looks like `$2b$10$AbifCttHxRChXl...` —
> full of `$`-delimited segments. Next.js's `.env` loader does `$VAR`-style
> substitution on values, and it silently mangled a raw hash in testing
> (stripped the `$2b$10$<salt>` prefix entirely, breaking login with no
> visible error). Base64 has no `$` in it, so it survives intact. The app
> decodes it back to the real hash before comparing.

## Step 1 — Generate your password hash

In a terminal, in `E:\ExpenseTracker`, run this — **replace `YourPassword`
with the password you actually want to use**:

```
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" "YourPassword"
```

It prints a base64 string with no `$` in it — copy the whole thing.

(If your password contains `"` or backticks, either avoid them or be
careful with your shell's quoting — simplest is to pick a password without
those characters.)

## Step 2 — Generate your signing secret

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the long hex string it prints.

## Step 3 — Add all three to your local `.env`

Open `E:\ExpenseTracker\.env` and fill in the three placeholder lines at the
bottom:

```
AUTH_USERNAME="whatever-username-you-want"
AUTH_PASSWORD_HASH="paste-the-base64-string-from-step-1"
AUTH_SECRET="paste-the-long-hex-string-from-step-2"
```

## Step 4 — Test locally

```
npm run dev
```

Visit `http://localhost:3000` — you should be redirected to `/login`. Sign
in with the username and password you chose (not the hash — the actual
password). You should land on the Dashboard, with a sign-out icon in the
top-right corner.

## Step 5 — Add the same three to Vercel

Your deployed site is a **separate environment** from your local machine —
it needs its own copy of these env vars, or it'll refuse every login.

1. Go to your project on [vercel.com](https://vercel.com) → **Settings** →
   **Environment Variables**.
2. Add three variables, same names as above:
   - `AUTH_USERNAME` → the same username
   - `AUTH_PASSWORD_HASH` → the same bcrypt hash (not the plain password)
   - `AUTH_SECRET` → the same signing secret
3. Set each to apply to **Production and Preview** (same as `DATABASE_URL`).
4. Redeploy (Deployments tab → latest deployment → Redeploy), since env var
   changes don't apply to an already-built deployment.

## Good to know

- **Sessions last 30 days.** After signing in you won't need to log in again
  for a month, on that browser. Signing out (the icon in the top-right)
  clears it immediately.
- **Changing your password later:** repeat Step 1 with a new password, and
  update `AUTH_PASSWORD_HASH` in both `.env` and Vercel.
- **If you ever suspect the secret leaked:** regenerate `AUTH_SECRET` (Step 2)
  and update it in both places — this immediately invalidates every existing
  session, forcing a fresh login everywhere.
- **Never commit `.env`.** It already stays out of git (see `.gitignore`) —
  this is the same protection your `DATABASE_URL` already relies on.
