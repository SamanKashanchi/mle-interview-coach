import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { canSpeak, speak, speakableText, stopSpeaking } from '../lib/speech'
import { Button } from './ui'

/** Play/stop button that reads a question out loud with the browser's own voice. */
export function ReadAloud({ title, prompt, className }: { title: string; prompt: string; className?: string }) {
  const [playing, setPlaying] = useState(false)

  // Stop when leaving the question.
  useEffect(() => stopSpeaking, [])

  if (!canSpeak()) return null

  const toggle = () => {
    if (playing) {
      stopSpeaking()
      setPlaying(false)
      return
    }
    setPlaying(true)
    speak(`${title}.\n${speakableText(prompt)}`, () => setPlaying(false))
  }

  return (
    <Button variant="secondary" onClick={toggle} className={className} aria-pressed={playing}>
      {playing ? <Square aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
      {playing ? 'Stop' : 'Read aloud'}
    </Button>
  )
}
