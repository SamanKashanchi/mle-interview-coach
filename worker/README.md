# Mac mini grader

Grades your answers about a minute after you submit them, using Claude Code on your Max plan
(no API key).

How it works: `grader.mjs` runs in the background. Every 10 seconds it asks Supabase how many
answers are waiting (`pending_grades()`, just a number). When one is, it runs Claude Code headless
with `grade-prompt.md`, which follows `agents/grading/README.md` and writes the grade through the
Supabase MCP. The question page picks the grade up by itself.

## Set up (once)

In Terminal on the Mac mini:

```bash
git clone https://github.com/SamanKashanchi/mle-interview-coach.git   # private: sign in to GitHub when asked
cd mle-interview-coach
./worker/setup.sh
```

The script tells you if something is missing and how to fix it:

1. **Node**: `brew install node`
2. **Claude Code**: `curl -fsSL https://claude.ai/install.sh | bash`, then run `claude` once and sign
   in with your Max account.
3. **Supabase sign-in**: run `claude` in this folder, type `/mcp`, pick `supabase`, then
   Authenticate.

Run `./worker/setup.sh` again after each fix. When it says "Grader is running", you're done.

## Day to day

- See what it did: `tail -f worker/grader.log`
- Update after a `git pull`: `./worker/setup.sh`
- Stop it: `./worker/setup.sh stop`

The service starts when you log in, restarts if it crashes, and keeps the Mac awake while it
runs. Turn on automatic login (System Settings > Users & Groups) so it survives a restart.

If the Mac is off, answers wait as pending; say "grade" in the project chat to grade them by hand.
