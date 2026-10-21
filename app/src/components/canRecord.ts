/** Whether this browser can record audio (MediaRecorder + microphone access). */
export const canRecord = () =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
