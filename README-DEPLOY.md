# Deploying Frank (GitHub → Supabase)

This turns Frank into a hosted web chat: a static page (`public/index.html`)
that talks to a Supabase Edge Function (`supabase/functions/frank-chat`),
which calls Groq.

**Before anything else:** rotate your Groq API key. The one in your old
`_env` file was shared in plaintext, so treat it as compromised — generate
a new one at console.groq.com and use *that* going forward.

## 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "Frank web chat"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Make sure `.env`, `.env.local`, and any file with a real key are in
`.gitignore` — never commit secrets.

## 2. Create a Supabase project

1. Go to https://supabase.com/dashboard → New Project.
2. Note your **Project Ref** (in the URL / project settings) and generate
   an **Access Token** at https://supabase.com/dashboard/account/tokens.

## 3. Deploy the Edge Function

**Option A — manual (fastest first deploy):**

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GROQ_API_KEY=your-new-groq-key
supabase functions deploy frank-chat --no-verify-jwt
```

Your endpoint will be:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/frank-chat`

**Option B — automatic via GitHub Actions (already set up in this repo):**

In your GitHub repo → Settings → Secrets and variables → Actions, add:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `GROQ_API_KEY`

Every push to `main` that touches `supabase/**` will auto-deploy via
`.github/workflows/deploy-supabase.yml`.

## 4. Point the frontend at your function

In `public/index.html`, set:

```js
const FRANK_ENDPOINT = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/frank-chat";
```

## 5. Host the frontend

Any static host works — Supabase Storage, GitHub Pages, Vercel, Netlify.
Simplest with GitHub Pages:

1. Repo → Settings → Pages → Deploy from branch → `main` → `/public`.
2. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Notes on what changed from the original desktop app

- Voice input/output (mic, edge-tts playback), the CPU/RAM monitor, and the
  smartwatch QR flow were all built around a persistent local Python
  process + Socket.IO — they don't run on serverless Edge Functions, so
  this web version is a lighter, pure text-chat rebuild of the same
  assistant personality.
- The aircraft/weather/places/device-tracking command modules are still
  in your repo as-is if you want to later wire them into the Edge
  Function as additional tool calls — just not included in this first
  lightweight pass, per your "lighter" request.
- Frank's system prompt now includes your creator/ROASOD background so it
  can answer questions about who built it and what ROASOD is.
