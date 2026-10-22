import { useEffect, useRef, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { db } from '../lib/db'
import { canSpeak, speak, speakableText, stopSpeaking } from '../lib/speech'
import { Button } from './ui'

/**
 * Play/stop button that reads a question out loud. Plays the natural-voice recording the Mac mini
 * made (audioPath) when there is one, otherwise the browser's own voice.
 */
export function ReadAloud({ title, prompt, audioPath, className }: { title: string; prompt: string; audioPath?: string | null; className?: string }) {
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)

  // Fetch the link up front: iPhone only plays audio started straight from the tap.
  useEffect(() => {
    if (!audioPath) return
    let el: HTMLAudioElement | null = null
    let gone = false
    db.questionAudioUrl(audioPath).then((url) => {
      if (!url || gone) return
      el = new Audio(url)
      el.preload = 'auto'
      el.onended = () => setPlaying(false)
      el.onpause = () => setPlaying(false)
      el.onplay = () => setPlaying(true)
      audio.current = el
    })
    return () => {
      gone = true
      el?.pause()
      audio.current = null
    }
  }, [audioPath])

  // Stop when leaving the question.
  useEffect(() => stopSpeaking, [])

  if (!audioPath && !canSpeak()) return null

  const toggle = () => {
    const el = audio.current
    if (playing) {
      el?.pause()
      stopSpeaking()
      setPlaying(false)
      return
    }
    setPlaying(true)
    if (el) {
      el.currentTime = 0
      // Shows the question on the lock screen, with play/pause there.
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Interview Coach' })
      el.play().catch(() => setPlaying(false))
    } else if (canSpeak()) {
      speak(`${title}.\n${speakableText(prompt)}`, () => setPlaying(false))
    } else {
      setPlaying(false)
    }
  }

  return (
    <Button variant="secondary" onClick={toggle} className={className} aria-pressed={playing}>
      {playing ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
      {playing ? 'Stop' : 'Read aloud'}
    </Button>
  )
}
