// Record a spoken answer in the browser (MediaRecorder). Safari on iPhone records AAC/MP4,
// Chrome records Opus/WebM; the Mac mini worker converts either one before transcribing.
// The screen is kept awake while recording, since iOS stops the recording when the phone locks.

import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { Button, InlineError } from './ui'
import { clock } from '../lib/useElapsed'
import { cx } from '../lib/cx'

const MAX_SECONDS = 30 * 60
const TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

type Phase = 'idle' | 'recording' | 'paused' | 'done'

/** Calls onChange with the finished recording, or null when it's cleared or a new one starts. */
export function VoiceRecorder({ onChange, disabled }: { onChange: (audio: Blob | null) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const wake = useRef<WakeLockSentinel | null>(null)
  const live = phase === 'recording' || phase === 'paused'

  // Tick while recording (not while paused).
  useEffect(() => {
    if (phase !== 'recording') return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (seconds >= MAX_SECONDS && phase === 'recording') stop()
  })

  // Don't lose a recording by closing the tab.
  useEffect(() => {
    if (phase === 'idle') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  // Clean up the mic, wake lock and playback URL when leaving the page.
  useEffect(
    () => () => {
      rec.current?.stream.getTracks().forEach((t) => t.stop())
      void wake.current?.release().catch(() => {})
    },
    [],
  )
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  async function start() {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      const denied = (e as DOMException).name === 'NotAllowedError'
      setError(
        denied
          ? 'The microphone is blocked. Allow it for this site (on iPhone: Settings > Apps > Safari > Microphone), then try again.'
          : `Couldn't start the microphone: ${(e as Error).message}`,
      )
      return
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const r = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
    chunks.current = []
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || 'audio/mp4' })
      setUrl(URL.createObjectURL(blob))
      setPhase('done')
      onChange(blob)
    }
    r.start(1000) // a chunk per second, so a long answer isn't held in one buffer
    rec.current = r
    setSeconds(0)
    setUrl(null)
    onChange(null)
    setPhase('recording')
    try {
      wake.current = await navigator.wakeLock?.request('screen')
    } catch {
      // Not supported or refused: recording still works while the screen stays on.
    }
  }

  function pause() {
    rec.current?.pause()
    setPhase('paused')
  }

  function resume() {
    rec.current?.resume()
    setPhase('recording')
  }

  function stop() {
    if (rec.current?.state !== 'inactive') rec.current?.stop()
    void wake.current?.release().catch(() => {})
    wake.current = null
  }

  function discard() {
    setUrl(null)
    setSeconds(0)
    setPhase('idle')
    onChange(null)
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-bg p-4">
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="flex size-20 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Mic aria-hidden className="size-8" />
            <span className="sr-only">Start recording</span>
          </button>
          <p className="text-sm text-muted">Tap to start, and answer out loud as you would in the interview.</p>
        </div>
      )}

      {live && (
        <div className="flex flex-col items-center gap-4 py-4" aria-live="polite">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className={cx('size-3 rounded-full bg-danger', phase === 'recording' && 'animate-pulse')} />
            <span className="text-3xl font-semibold tabular-nums">{clock(seconds)}</span>
          </div>
          <p className="text-sm text-muted">{phase === 'recording' ? 'Recording. Keep the screen on.' : 'Paused.'}</p>
          <div className="flex gap-3">
            {phase === 'recording' ? (
              <Button variant="secondary" onClick={pause} className="min-h-12 px-5">
                <Pause aria-hidden className="size-5" /> Pause
              </Button>
            ) : (
              <Button variant="secondary" onClick={resume} className="min-h-12 px-5">
                <Play aria-hidden className="size-5" /> Resume
              </Button>
            )}
            <Button onClick={stop} className="min-h-12 px-5">
              <Square aria-hidden className="size-5" /> Stop
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && url && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Recorded {clock(seconds)}. Listen back if you like, then submit.</p>
          <audio controls src={url} className="w-full" />
          <div>
            <Button variant="ghost" onClick={discard} disabled={disabled}>
              <RotateCcw aria-hidden className="size-4" /> Record again
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </div>
  )
}
