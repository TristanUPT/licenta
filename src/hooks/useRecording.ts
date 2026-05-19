import { useEffect, useRef, useState } from 'react'
import { getContext, getNode } from '@/audio/engine'

export function useRecording() {
  const [micActive,    setMicActive]    = useState(false)
  const [isRecording,  setIsRecording]  = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [recExt,       setRecExt]       = useState('webm')
  const [micError,     setMicError]     = useState<string | null>(null)

  const micStreamRef = useRef<MediaStream | null>(null)
  const micGainRef   = useRef<GainNode | null>(null)
  const recDestRef   = useRef<MediaStreamAudioDestinationNode | null>(null)
  const recorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const urlRef       = useRef<string | null>(null)

  async function toggleMic() {
    if (micActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      micGainRef.current?.disconnect()
      micStreamRef.current = null
      micGainRef.current   = null
      setMicActive(false)
      return
    }

    if (!('mediaDevices' in navigator)) {
      setMicError('Microphone not supported in this browser')
      return
    }

    const ctx  = getContext()
    const node = getNode()
    if (!ctx || !node) {
      setMicError('Start the engine first')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const source = ctx.createMediaStreamSource(stream)
      const gain   = ctx.createGain()
      gain.gain.value = 1.0
      source.connect(gain)
      gain.connect(node)   // feeds mic into worklet input alongside file audio
      micStreamRef.current = stream
      micGainRef.current   = gain
      setMicActive(true)
      setMicError(null)
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  function startRecording() {
    const ctx  = getContext()
    const node = getNode()
    if (!ctx || !node) return

    // Lazy-create the recording tap (persists once connected).
    if (!recDestRef.current) {
      recDestRef.current = ctx.createMediaStreamDestination()
      node.connect(recDestRef.current)
    }

    const mimeType =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? ''

    chunksRef.current = []
    const recorder = new MediaRecorder(
      recDestRef.current.stream,
      mimeType ? { mimeType } : undefined,
    )

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(blob)
      setRecExt(recorder.mimeType.includes('ogg') ? 'ogg' : 'webm')
      setRecordingUrl(urlRef.current)
      setIsRecording(false)
    }

    recorder.start(100)   // collect data every 100 ms
    recorderRef.current = recorder
    setIsRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  function clearRecording() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setRecordingUrl(null)
  }

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  return {
    micActive, isRecording, recordingUrl, recExt, micError,
    toggleMic, startRecording, stopRecording, clearRecording,
  }
}
