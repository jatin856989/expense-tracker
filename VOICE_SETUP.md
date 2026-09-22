# Setting Up Voice Entry

There's now a microphone button (bottom-right, on every page) — tap it, say
something like *"add expense 500 for groceries, paid cash"* or *"I lent
Rahul 2000"*, and it creates the entry automatically. A toast confirms what
was added, with an **Undo** button in case it misheard you.

## How it works

- **Speech-to-text** happens entirely in your browser (the free, built-in
  Web Speech API) — no audio ever leaves your device.
- The **transcribed text** is sent to [Groq](https://groq.com), a free,
  very fast AI API, which figures out what you meant (expense vs. income
  vs. transfer vs. a loan, the amount, which of your actual categories/
  cards/accounts it matches, etc.) and returns structured data.
- The app then creates the transaction or loan directly — no confirmation
  step, by design, since the whole point is speed. Undo is there if it
  gets something wrong.

## Step 1 — Get a free Groq API key

1. Go to **[console.groq.com](https://console.groq.com)** and sign up
   (Google or GitHub login works, no credit card required).
2. Go to **API Keys** in the left sidebar → **Create API Key**.
3. Copy the key (starts with `gsk_...`) — you only see it once.

## Step 2 — Add it locally

Open `E:\ExpenseTracker\.env` and paste it in:

```
GROQ_API_KEY="gsk_your-actual-key-here"
```

Restart `npm run dev` if it's already running, then try the mic button.

## Step 3 — Add it to Vercel

1. Go to your project on **vercel.com** → **Settings** →
   **Environment Variables**.
2. Add `GROQ_API_KEY` with the same value, applied to **Production and
   Preview**.
3. Redeploy (Deployments tab → latest → Redeploy).

## Using it

- Tap the mic, speak one sentence, then either pause (it stops listening
  automatically after a moment of silence) or tap **Stop**.
- It works best with a clear amount and a recognizable category/card/
  account name — e.g. *"paid 450 for lunch on my HDFC card"* rather than
  just *"spent some money"*.
- If it can't confidently figure out an amount or what you meant, it won't
  guess — you'll get a toast saying so instead of a wrong entry.
- Currently understands two things: **transactions** (expense / income /
  transfer) and **loans** (lent / borrowed). Investments, budgets, and
  recurring bills aren't voice-enabled yet — those are more deliberate
  entries anyway, better suited to the regular forms.

## Good to know

- **Requires HTTPS.** Voice input needs a "secure context" — it'll work
  fine on your deployed `https://...vercel.app` site, but may not work
  when testing over your local network's IP address (e.g.
  `http://192.168.x.x:3000`) from your phone during development.
  `http://localhost:3000` on the same machine is fine.
- **Free tier limits:** Groq's free tier comfortably covers personal,
  occasional use like this. Check current limits at
  [console.groq.com/settings/limits](https://console.groq.com/settings/limits)
  if you're curious.
- **Browser support:** works well in Chrome (desktop and Android) and
  Safari on iOS 14.5+. If your browser doesn't support it, the mic button
  will tell you instead of failing silently.
- **What gets sent to Groq:** only the transcribed text of what you said,
  plus the *names* of your categories/cards/accounts (so it can match
  against them) — never amounts, balances, or any other financial data
  beyond that one sentence.
