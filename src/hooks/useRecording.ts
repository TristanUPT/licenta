import { useEffect, useRef, useState, useCallback } from 'react'
import { getContext, getNode, start as startEngine } from '@/audio/engine'
import { encodeWav } from '@/audio/wav-encoder'

export function useRecording() {
  const [micActive, setMicActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const [recordingSec, setRecordingSec] = useState(0)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [monitoring, setMonitoring] = useState(false)

  const micStreamRef = useRef<MediaStream | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micGainRef = useRef<GainNode | null>(null)
  const monitorGainRef = useRef<GainNode | null>(null)
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  // ─── Device enumeration ──────────────────────────────────────────────────

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setMicError('Device enumeration not supported')
      return
    }
    try {
      let devices = await navigator.mediaDevices.enumerateDevices()
      let inputs = devices.filter((d) => d.kind === 'audioinput')
      if (inputs.length > 0 && inputs[0]!.label === '') {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach((t) => t.stop())
        devices = await navigator.mediaDevices.enumerateDevices()
        inputs = devices.filter((d) => d.kind === 'audioinput')
      }
      setAudioDevices(inputs)
      setMicError(null)
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Cannot list audio devices')
    }
  }, [])

  // ─── Mic connect / disconnect ────────────────────────────────────────────

  function disconnectMic() {
    if (monitorGainRef.current) {
      monitorGainRef.current.disconnect()
      monitorGainRef.current = null
      setMonitoring(false)
    }
    micSourceRef.current?.disconnect()
    micGainRef.current?.disconnect()
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    micSourceRef.current = null
    micGainRef.current = null
    setMicActive(false)
    setSelectedDeviceId(null)
  }

  async function selectDevice(deviceId: string) {
    let ctx = getContext()
    const node = getNode()
    if (!ctx || !node) {
      try {
        await startEngine()
        ctx = getContext()
      } catch {
        setMicError('Cannot start audio engine')
        return
      }
    }
    if (!ctx || !getNode()) {
      setMicError('Audio engine not available')
      return
    }

    const wasRecording = isRecording
    if (wasRecording) {
      recorderRef.current?.stop()
      recorderRef.current = null
    }

    disconnectMic()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      })
      const source = ctx.createMediaStreamSource(stream)
      const gain = ctx.createGain()
      gain.gain.value = 1.0
      source.connect(gain)
      gain.connect(getNode()!)

      micStreamRef.current = stream
      micSourceRef.current = source
      micGainRef.current = gain
      setMicActive(true)
      setSelectedDeviceId(deviceId)
      setMicError(null)
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  // ─── Monitor toggle ──────────────────────────────────────────────────────

  function toggleMonitor() {
    const ctx = getContext()
    if (!ctx || !micGainRef.current) return

    if (monitoring) {
      monitorGainRef.current?.disconnect()
      monitorGainRef.current = null
      setMonitoring(false)
    } else {
      const monGain = ctx.createGain()
      monGain.gain.value = 1.0
      micGainRef.current.connect(monGain)
      monGain.connect(ctx.destination)
      monitorGainRef.current = monGain
      setMonitoring(true)
    }
  }

  // ─── Recording ───────────────────────────────────────────────────────────

  function startRecording() {
    const ctx = getContext()
    const node = getNode()
    if (!ctx || !node) return
    if (isRecording) return

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
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })

      void (async () => {
        try {
          const arrayBuf = await blob.arrayBuffer()
          const audioCtx = getContext()
          if (!audioCtx) throw new Error('No AudioContext')
          const decoded = await audioCtx.decodeAudioData(arrayBuf)
          const wavBlob = encodeWav(decoded)
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = URL.createObjectURL(wavBlob)
          setRecordingUrl(urlRef.current)
        } catch {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = URL.createObjectURL(blob)
          setRecordingUrl(urlRef.current)
        }
        setIsRecording(false)
      })()
    }

    recorder.start(100)
    recorderRef.current = recorder
    setIsRecording(true)
    setRecordingSec(0)
    timerRef.current = window.setInterval(() => {
      setRecordingSec((s) => s + 1)
    }, 1000)
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
    setRecordingSec(0)
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      monitorGainRef.current?.disconnect()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [])

  return {
    micActive, isRecording, recordingUrl, recordingSec, micError,
    audioDevices, selectedDeviceId, monitoring,
    enumerateDevices, selectDevice, disconnectMic, toggleMonitor,
    startRecording, stopRecording, clearRecording,
  }
}
