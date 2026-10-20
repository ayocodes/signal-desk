# Setup (you do this, about 45 minutes)

Everything here is free. If any service asks for a payment card, stop and don't add one.

## 0. Tools on your Mac

- [x] Node.js 20 or newer: `node -v`
- [x] Python 3.12: `python3 --version`
- [x] Git: `git --version`
- [x] GitHub CLI: `brew install gh`, then `gh auth login`
- [x] Supabase CLI: `brew install supabase/tap/supabase`
- [x] Claude Code installed and logged in

## 1. GitHub

- [x] Create a **public** repo (public = free GitHub Actions minutes, and Cardinal can read your code).
- [x] Clone it, copy this kit into it, commit: `git add . && git commit -m "Project kit"`.

## 2. Supabase (database + login)

- [x] Create an account at supabase.com and a new project on the free plan. Pick the region closest to you (a European region is closest to Abuja).
- [x] Save the database password somewhere safe.
- [x] Project Settings → API: copy the **Project URL**, the **anon / publishable** key, and the **service_role / secret** key. (Supabase has been renaming these; either name works.)
- [x] In the terminal, from the repo: `supabase login`, then `supabase link --project-ref <your-ref>`.

The service_role key bypasses all security rules. It goes only in `.env.local` and GitHub secrets, never in browser code.

## 3. Gemini (AI drafts)

- [x] Go to Google AI Studio (aistudio.google.com), sign in, click **Get API key**, create a key.
- [x] In AI Studio, open the rate-limit page and note which Flash models your project can use for free. Put that model id in `GEMINI_MODEL`.
- [x] If AI Studio asks you to set up billing or a prepaid plan: stop. Create a free Groq key at console.groq.com instead (no card needed) and set `LLM_PROVIDER=groq`.

## 4. Resend (email)

- [x] Create an account at resend.com (free plan).
- [x] API Keys → create a key with sending access.
- [ ] Leave webhooks for later. They need your deployed URL (phase 5).

## 5. Vercel

- [x] Import the GitHub repo in Vercel (Hobby plan). It will fail to build until phase 1 is done; that's fine.
- [x] Add the same env vars as `.env.local` in Project Settings → Environment Variables (not the GitHub-only ones).

## 6. Env files

- [x] `cp .env.example .env.local` and fill in the values.
- [x] Check `.env.local` is in `.gitignore` before your next commit: `git status` must not list it.

## 7. GitHub Actions secrets (for the background agent)

Repo → Settings → Secrets and variables → Actions → New repository secret:

- [x] `SUPABASE_URL`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `GEMINI_API_KEY` (or `GROQ_API_KEY`)
- [x] `GEMINI_MODEL`
- [x] `LLM_PROVIDER`
- [x] `RESEND_API_KEY`
- [x] `RESEND_FROM`
- [x] `AGENT_USER_AGENT`

## Keys summary

| Key | Where it comes from | Goes in |
|---|---|---|
| Supabase URL + anon key | Supabase → API | `.env.local`, Vercel |
| Supabase service_role key | Supabase → API | `.env.local`, Vercel, GitHub secrets |
| Gemini API key | Google AI Studio | `.env.local`, Vercel, GitHub secrets |
| Resend API key | Resend → API Keys | `.env.local`, Vercel, GitHub secrets |
| Resend webhook secret | Resend → Webhooks (phase 5) | `.env.local`, Vercel |
| GitHub token (optional) | GitHub → fine-grained token, Actions write on this repo only | Vercel only (for the "Run agent now" button) |
