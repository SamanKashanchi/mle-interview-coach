// Voice answers: shared between the real and mock backends and the answer panel.

/** body of a voice answer until the Mac mini worker swaps in the transcript. */
export const VOICE_PLACEHOLDER = 'Voice answer, waiting to be transcribed.'

export const isVoice = (a: { audio_path: string | null }) => a.audio_path != null
export const awaitingTranscript = (a: { audio_path: string | null; transcribed_at: string | null }) =>
  a.audio_path != null && a.transcribed_at == null

export function audioExtension(type: string) {
  if (type.includes('webm')) return 'webm'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('wav')) return 'wav'
  return 'm4a' // Safari on iPhone records AAC in an MP4 container
}
