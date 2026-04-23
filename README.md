# Maverick Planner

A warm, lived-in personal planner organized around life domains, weekly rhythm, and reflection.

Built with **Vite + React + Tailwind**, deployed as a **PWA on Vercel**. localStorage persistence, no database. The AI Reflection Coach is served by a Vercel Edge Function that proxies to the Anthropic API.

## Features

### Core
- **Six Life Domains** — Work, Ministry, Family, Projects, Faith, Home. Every task is tagged to one.
- **Today view** — Top 3 priorities, overdue tracking, full day's tasks, editable habits with streaks and week strips, daily journal.
- **Weekly rhythm** — Sunday Plan (3 big rocks + scripture focus + notes), Friday Reflect (domain performance, score, what-worked/didn't/next-focus).
- **Journal** — Hybrid format (rotating prompt + free-form), domain tagging, full-text search, past entries list.
- **Domains deep-view** — Per-domain goals (max 3), task list, standing notes, completed history.
- **Archive** — Browse all completed tasks by date and domain filter.
- **Inbox** — Quick-capture from any screen, sort to domains later.

### Power features
- **Natural language task entry** — `finish brisket rub tomorrow #home ⭐` parses into text + domain + date + priority + recurrence.
- **Recurring tasks** — `every day`, `every weekday`, `every mon`, `every 2 weeks`, `monthly`. Auto-spawns next instance on completion.
- **AI Reflection Coach** (Fridays only) — Analyzes all-time planning data via the Anthropic API and surfaces 2-4 specific cross-week patterns.
- **Habit streaks** — Flame counter, 7-day week strip for each habit.
- **Export/Import** — Full JSON backup and restore.

## Stack

- **Vite** — dev server and bundler
- **React 18** — UI
- **Tailwind CSS** — styling (utility-first, with custom Fraunces + Lora font stack)
- **lucide-react** — icons
- **localStorage** — persistence
- **Vercel Edge Functions** — the `/api/analyze` proxy for the AI coach

## Local Development

```bash
npm install
npm run dev
```

App opens at `http://localhost:5173`. All data persists in localStorage under the key `maverick-planner-v3`.

### Running the AI Coach locally

The coach calls `/api/analyze`, which is a Vercel Edge Function. To test it locally:

```bash
npm install -g vercel
vercel dev
```

This runs both the Vite dev server and the serverless function together on `http://localhost:3000`. You'll also need `ANTHROPIC_API_KEY` set — either pull it from Vercel after linking (`vercel env pull .env.local`) or create `.env.local` manually:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Without the key, the coach will show an error but every other feature works fully.** It's the only feature that requires the API.

## Deploying to Vercel

### Option 1: Via GitHub (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Vite. Click Deploy.
4. **Add your API key**: Project Settings → Environment Variables → add `ANTHROPIC_API_KEY` with your Anthropic key, then redeploy.
5. Done — you'll get a `*.vercel.app` URL.

### Option 2: Via Vercel CLI

```bash
npm install -g vercel
vercel                             # first deploy — prompts to link
vercel env add ANTHROPIC_API_KEY   # add your key
vercel --prod                      # promote to production
```

## Installing as a PWA

Once deployed:

- **iOS** (Safari) — Share button → Add to Home Screen. Opens standalone with the Six Domains icon.
- **Android** (Chrome) — "Install app" prompt appears, or Menu → Install app.
- **Desktop** (Chrome/Edge) — Install icon appears in the address bar.

## Security Notes

- **API key is server-side only**. The key lives in Vercel's env vars and is read by `api/analyze.js` (Edge Function). It is never shipped to the browser.
- **No CORS issues**. Requests go to `/api/analyze` (same origin) rather than `api.anthropic.com` directly.
- **No rate limiting** is built in. For a personal planner this is fine. If you ever made this multi-user, you'd want to add it.

## Project Structure

```
maverick-planner/
├── api/
│   └── analyze.js          # Vercel Edge Function — proxies to Anthropic
├── public/
│   ├── icons/              # All PWA icons (SVG sources + PNG renders + ICO)
│   └── manifest.json       # PWA manifest
├── src/
│   ├── MaverickPlanner.jsx # The entire app (~2700 lines, single file by design)
│   ├── main.jsx            # React entry point
│   └── index.css           # Tailwind base + global resets
├── index.html              # Root HTML with PWA head wiring + font loading
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json             # SPA routing + cache headers
└── package.json
```

## Data Model (localStorage)

Stored under `maverick-planner-v3`:

```js
{
  version: 3,
  tasks: [{ id, text, domain, done, top3, dueDate, createdAt, completedAt?, recurrence?, parentId? }],
  inbox: [{ id, text, captured }],
  journal: { [date]: { text, tags: [domainId] } },
  habits: [{ id, label, dates: { [date]: bool } }],
  notes: { [domainId]: text },
  goals: { [domainId]: [{ id, text, createdAt }] },
  weeks: {
    [sundayIso]: {
      bigRocks: [{ id, text, domain, done }],
      scripture, planNotes,
      worked, didntWork, nextFocus, score,
      aiInsights?: { generatedAt, observations: [...] }
    }
  }
}
```

Migration from v1 → v2 → v3 is automatic on first load if an older version is present in localStorage.

## License

Personal project. Do whatever.
