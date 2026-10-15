# MLE Interview Coach

A personal, adaptive interview coach for ML Engineer roles: it learns your targets, researches what those
companies test, and runs daily practice that closes the gap.

## Status

Early. Only the setup page exists so far.

- `web/setup.html`: collects target roles, level, target companies, pasted job descriptions, an optional
  resume, a ready-by date and minutes per day. It's a single static page. Inside claude.ai it saves to the
  artifact's database and file storage. Opened anywhere else, it keeps answers in the browser's local storage.

Hosting and stack are not decided yet.
