// Read aloud: the browser's built-in text-to-speech (Web Speech API). Free, no model or backend.

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Markdown prompt -> plain sentences worth hearing. Code blocks and tables are skipped. */
export function speakableText(md: string): string {
  return md
    .replace(/```[\s\S]*?(```|$)/g, '\n(Code block skipped.)\n')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line)) // table rows
    .join('\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*#{1,6}\s+(.*)$/gm, '$1.') // headings become a sentence
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '') // list markers
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(\S[\s\S]*?\S|\S)\1/g, '$2')
    .replace(/(\(Code block skipped\.\)\s*)+/g, '(Code block skipped.) ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Short chunks: Chrome stops long utterances after ~15s, and iOS handles a queue well. */
function chunks(text: string): string[] {
  const parts = (text.match(/[^.!?:\n]+([.!?:]+|\n|$)/g) ?? []).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if (last && last.length + p.length < 200) out[out.length - 1] = `${last} ${p}`
    else out.push(p)
  }
  return out
}

let run = 0

/** Speaks text; calls onEnd when finished or cancelled. Must start from a tap on iPhone. */
export function speak(text: string, onEnd: () => void, rate = 1) {
  const synth = window.speechSynthesis
  synth.cancel()
  const mine = ++run
  // A cancelled run can still fire events late; only the current run reports back.
  const done = () => mine === run && onEnd()
  const parts = chunks(text)
  if (!parts.length) return done()
  const voice = synth.getVoices().find((v) => v.default && v.lang.startsWith('en')) ?? synth.getVoices().find((v) => v.lang.startsWith('en'))
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p)
    u.rate = rate
    if (voice) u.voice = voice
    if (i === parts.length - 1) u.onend = done
    u.onerror = done
    synth.speak(u)
  })
}

export function stopSpeaking() {
  run++
  if (canSpeak()) window.speechSynthesis.cancel()
}
