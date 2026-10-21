# MLE Interview Coach

A personal, adaptive interview coach for ML Engineer roles: it learns your targets, researches what those
companies test, and runs daily practice that closes the gap.

## How it fits together

1. **Inputs**: you enter your level, targets (company + role + optional job posting), resume, ready-by date
   and minutes per day in the portal.
2. **Research** (`agents/research/`): Claude builds one shared interview profile per company + role.
3. **Plan** (`agents/blueprint/`): a per-user weight for each of 42 topics, from research × posting × resume.
4. **Questions** (`agents/questions/`): a daily set aimed at your gaps: priority = plan weight × how weak you are ×
   recency, with spaced reviews of low-scoring topics, difficulty per topic, and a reason for each pick.
5. **Grading** (`agents/grading/`): you answer in the portal; Claude scores each rubric point and writes feedback
   and a model answer.

Steps 2 to 5 are run by Claude from the project chat (say "grade" to grade pending answers). The portal reads their output and shows what's pending.

## The portal (`app/`)

A Vite + React + TypeScript app styled with Tailwind. Pages: sign-in, a first-run setup wizard, then
Today (daily goal ring), Question (answer, then see your grade), History (calendar and
weak spots, every past day), Plan (with a mastery level per topic), Targets (with each company's research) and Profile. All database access goes
through `app/src/lib/db.ts`; mastery and reviews are computed in `app/src/lib/progress.ts`.

### Run it locally (Windows PowerShell)

```powershell
cd app
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:8000, enter your email, and click the link Supabase sends you.

To try it on fixture data with no database, run `npm run mock` instead of `npm run dev`. Add `?mock=new`
to the URL to see the setup wizard, or `?mock=signedout` for the sign-in page.

### Checks

```powershell
npm run build
npm run lint
npm run build:mock
npx vite preview --mode mock
```

With the preview running, `npm run screenshots` (in a second terminal) clicks through every page at desktop
and phone widths, in light and dark, fails on page errors or sideways scrolling, and saves images to
`app/screenshots/`.

## Hosting (Vercel)

The Vercel project points at this repo with **Root Directory `app`**. `app/vercel.json` sets the Vite build and
sends every path to `index.html` so links like `/history` work on reload. `app/.env.production` holds the public
Supabase URL and publishable key, so no Vercel environment variables are needed. The deployed URL must be listed
under Supabase → Authentication → URL Configuration → Redirect URLs, or magic links won't sign you in.

## Database setup (already done for the live project)

1. In the Supabase dashboard, open SQL Editor and run `supabase/schema.sql`, then `supabase/seed_topics.sql`.
2. Authentication -> URL Configuration: set Site URL to `http://localhost:8000` (and add it under Redirect URLs).
3. Put the Project URL and the publishable key in `app/.env.local`. Never use the `service_role` key here.
4. Once your account exists, turn off "Allow new users to sign up" under Authentication -> Sign In / Providers.

## The worker on the Mac mini

`worker/` grades answers about a minute after they're submitted, researches new targets, and
writes each day's questions from 5 AM, all with Claude Code on the owner's Max plan. See [worker/README.md](worker/README.md) for the three-step setup.
