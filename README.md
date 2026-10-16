# MLE Interview Coach

A personal, adaptive interview coach for ML Engineer roles: it learns your targets, researches what those
companies test, and runs daily practice that closes the gap.

## Status

Early. Only the setup page exists so far: target roles, level, target companies, pasted job descriptions,
an optional resume, a ready-by date and minutes per day. Data is stored in Supabase.

Hosting is not decided yet; the page runs locally.

## Setup

1. **Create the database.** In the Supabase dashboard, open SQL Editor, paste `supabase/schema.sql` and run it.
   It creates the `profiles` and `job_descriptions` tables, a private `resumes` storage bucket, and
   row-level security so each signed-in user only sees their own data.
2. **Allow the local sign-in redirect.** Authentication -> URL Configuration: set Site URL to
   `http://localhost:8000` (and add it under Redirect URLs).
3. **Point the page at your project.** Copy the Project URL and the anon / publishable key from
   Project Settings -> API into `web/config.js`. Never use the `service_role` key here.
4. **Run it.**
   ```bash
   cd web && python3 -m http.server 8000
   ```
   Open http://localhost:8000, enter your email, and click the link Supabase sends you.
5. **Lock sign-ups** once your account exists: Authentication -> Sign In / Providers -> turn off
   "Allow new users to sign up", so nobody else can create an account on your project.
