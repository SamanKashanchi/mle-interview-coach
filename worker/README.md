# Mac mini worker

Runs the coach's AI jobs on your Max plan with Claude Code (no API key):

| Job | When | Prompt |
|---|---|---|
| Grade | about a minute after you submit an answer; spoken answers are transcribed first with Whisper, on the Mac | `prompts/grade.md` → `agents/grading/README.md`, `transcribe.mjs` |
| Research | a few minutes after you save a target whose company + role has no research yet; then it rebuilds your focus topics | `prompts/research.md` → `agents/research/prompt.md`, `agents/blueprint/README.md` |
| Daily questions | from 5 AM local time, if today has no set yet | `prompts/questions.md` → `agents/questions/README.md` |
| Questions on request | a minute or so after you press **Generate questions** on Today | `prompts/requests.md` → `agents/questions/README.md` |
| Spoken questions | a few seconds after a question is written; no Claude, Kokoro runs on the Mac | `tts.mjs`, `tts/speak.py` |

How it works: `worker.mjs` runs in the background. Every 10 seconds it asks Supabase what needs
doing (`worker_todo()`, just four counts). When something does, it runs Claude Code headless with
that job's prompt, which reads and writes the database through the Supabase MCP. Grading and
requested questions run alongside the other jobs. Questions wait for research, so a new target makes it into that day's set.
If the Mac was off at 5 AM, the set is written as soon as it's back on.

## Set up (once)

In Terminal on the Mac mini:

```bash
git clone https://github.com/SamanKashanchi/mle-interview-coach.git   # private: sign in to GitHub when asked
cd mle-interview-coach
./worker/setup.sh
```

The script tells you if something is missing and how to fix it:

1. **Node**: `brew install node`
2. **Python 3**: `xcode-select --install` (usually already there)
3. **Homebrew** (https://brew.sh): the script uses it to install Whisper and ffmpeg, then downloads
   the Whisper model (about 550 MB, once) into `worker/models/`. It also installs Kokoro, the voice
   for Read aloud (about 350 MB, once), and registers this Mac's upload key in `worker/.worker-token`.
4. **Claude Code**: `curl -fsSL https://claude.ai/install.sh | bash`, then run `claude` once and sign
   in with your Max account.
5. **Supabase sign-in**: run `claude` in this folder, type `/mcp`, pick `supabase`, then
   Authenticate.

Run `./worker/setup.sh` again after each fix. When it says "Worker is running", you're done.

## Day to day

- See what it did: `tail -f worker/worker.log`
- Update after a `git pull`: `./worker/setup.sh`
- Stop it: `./worker/setup.sh stop`
- Change the question time (default 5 AM): `QUESTIONS_HOUR=6 ./worker/setup.sh`
- Change the Read aloud voice (default `bf_emma`, British female): `TTS_VOICE=bf_isabella ./worker/setup.sh`.
  Voices starting `bf_`/`bm_` are British, `af_`/`am_` American. New questions use the new voice.

The service starts when you log in, restarts if it crashes, and keeps the Mac awake while it
runs. Turn on automatic login (System Settings > Users & Groups) so it survives a restart.

If a job makes no progress (signed out, Supabase not connected, usage limits), the worker waits
longer between tries, up to 30 minutes, instead of burning usage. If the Mac is off, everything
waits; you can still say "grade", "research now" or "new questions" in the project chat.
