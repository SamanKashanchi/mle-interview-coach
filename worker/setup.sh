#!/bin/bash
# Sets up the coach's worker on this Mac (grading, research, daily questions, spoken questions): connects Claude Code
# to Supabase and installs a background service that starts at login, restarts if it crashes and
# keeps the Mac awake.
#   ./worker/setup.sh          install or update
#   ./worker/setup.sh stop     remove the service
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LABEL="com.mlecoach.worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "stop" ]]; then
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Worker stopped and removed."
  exit 0
fi

NODE="$(command -v node || true)"
CLAUDE="$(command -v claude || true)"
if [[ -z "$NODE" ]]; then
  echo "Node is missing. Install it with: brew install node   (or from https://nodejs.org), then run this again."
  exit 1
fi
if [[ -z "$CLAUDE" ]]; then
  echo "Claude Code is missing. Install it with: curl -fsSL https://claude.ai/install.sh | bash"
  echo "Then run: claude   (sign in with your Max account), and run this again."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is missing (the question writer runs Python to check coding questions)."
  echo "Install it with: xcode-select --install   (or brew install python), then run this again."
  exit 1
fi

# PGlite, for checking SQL questions' expected output.
npm install --prefix worker --no-audit --no-fund --silent

# Whisper (runs on this Mac) and ffmpeg, for transcribing voice answers.
if ! command -v whisper-cli >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is missing (needed to install Whisper and ffmpeg for voice answers)."
    echo "Install it from https://brew.sh, then run this again."
    exit 1
  fi
  echo "Installing Whisper and ffmpeg for voice answers..."
  brew install whisper-cpp ffmpeg
fi
MODEL="worker/models/ggml-large-v3-turbo-q5_0.bin"
if [[ ! -s "$MODEL" ]]; then
  echo "Downloading the Whisper model (about 550 MB, once)..."
  mkdir -p worker/models
  curl -fL --progress-bar -o "$MODEL.part" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
  mv "$MODEL.part" "$MODEL"
fi

# Kokoro (runs on this Mac) for the natural voice behind Read aloud. It needs Python 3.10 to 3.13.
if [[ ! -x worker/tts/venv/bin/python ]]; then
  PY=""
  for v in 3.12 3.13 3.11 3.10; do
    if command -v "python$v" >/dev/null 2>&1; then PY="python$v"; break; fi
  done
  if [[ -z "$PY" ]]; then
    echo "Installing Python 3.12 for the voice..."
    brew install python@3.12
    PY="$(brew --prefix)/bin/python3.12"
  fi
  "$PY" -m venv worker/tts/venv
fi
worker/tts/venv/bin/pip install --quiet --disable-pip-version-check kokoro-onnx soundfile
KOKORO="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [[ ! -s "worker/models/$f" ]]; then
    echo "Downloading the voice model $f (about 350 MB in all, once)..."
    mkdir -p worker/models
    curl -fL --progress-bar -o "worker/models/$f.part" "$KOKORO/$f"
    mv "worker/models/$f.part" "worker/models/$f"
  fi
done

# Supabase MCP for this folder only, limited to the database tools.
if ! "$CLAUDE" mcp get supabase >/dev/null 2>&1; then
  "$CLAUDE" mcp add --transport http --scope local supabase \
    "https://mcp.supabase.com/mcp?project_ref=uwmenprzfrtlqujmvlyq&features=database" >/dev/null
fi
if ! "$CLAUDE" mcp list 2>/dev/null | grep -q "^supabase:.*Connected"; then
  echo
  echo "One more step: sign Claude Code in to Supabase."
  echo "  1. In this folder, run: claude"
  echo "  2. Type /mcp, pick supabase, then Authenticate. Approve it in the browser."
  echo "  3. Type /exit and run ./worker/setup.sh again."
  exit 1
fi

# The worker's key for uploading spoken questions (the question-audio function). Made here, kept in
# worker/.worker-token; only its sha256 goes to Supabase, registered once through Claude Code.
AUDIO_FN="https://uwmenprzfrtlqujmvlyq.supabase.co/functions/v1/question-audio"
key_works() { [[ -s worker/.worker-token ]] && curl -fsS -o /dev/null -H "x-worker-token: $(cat worker/.worker-token)" "$AUDIO_FN" 2>/dev/null; }
if ! key_works; then
  [[ -s worker/.worker-token ]] || (umask 077 && openssl rand -hex 32 > worker/.worker-token)
  HASH="$(printf %s "$(cat worker/.worker-token)" | shasum -a 256 | cut -d' ' -f1)"
  echo "Registering this Mac's key for spoken questions..."
  "$CLAUDE" -p "Run exactly this SQL with the Supabase execute_sql tool and nothing else, then reply done: insert into public.worker_tokens (hash) values ('$HASH') on conflict do nothing;" \
    --allowedTools mcp__supabase__execute_sql >/dev/null || true
  if ! key_works; then
    echo "Couldn't register the key, so questions won't get the natural voice yet (Read aloud uses the"
    echo "phone's voice meanwhile). Everything else still works. Run ./worker/setup.sh again later."
  fi
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-i</string>
    <string>$NODE</string><string>$ROOT/worker/worker.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$NODE"):$(dirname "$CLAUDE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>CLAUDE_BIN</key><string>$CLAUDE</string>
    <!-- launchd doesn't inherit the shell's env; Homebrew's Node needs this to find the system
         root certificates, otherwise every HTTPS fetch fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY. -->
    <key>NODE_EXTRA_CA_CERTS</key><string>${NODE_EXTRA_CA_CERTS:-/etc/ssl/cert.pem}</string>
    <key>QUESTIONS_HOUR</key><string>${QUESTIONS_HOUR:-5}</string>
    <key>TTS_VOICE</key><string>${TTS_VOICE:-bf_emma}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$ROOT/worker/service.log</string>
  <key>StandardErrorPath</key><string>$ROOT/worker/service.log</string>
</dict>
</plist>
PLIST

launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Worker is running. It transcribes and grades new answers within seconds, researches new targets,"
echo "writes each day's questions from 5 AM, and records each new question in a natural voice."
echo "Watch it with: tail -f worker/worker.log"
