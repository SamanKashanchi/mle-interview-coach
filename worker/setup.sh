#!/bin/bash
# Sets up the coach's worker on this Mac (grading, research, daily questions): connects Claude Code
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
    <key>QUESTIONS_HOUR</key><string>${QUESTIONS_HOUR:-5}</string>
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
echo "and writes each day's questions from 5 AM."
echo "Watch it with: tail -f worker/worker.log"
