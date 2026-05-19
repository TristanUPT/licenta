import { useEffect, useRef, useState } from 'react'

export interface MidiDevice {
  id: string
  name: string
}

interface UseMidiOptions {
  onNoteOn:  (midi: number) => void
  onNoteOff: (midi: number) => void
}

export function useMidi({ onNoteOn, onNoteOff }: UseMidiOptions) {
  const [devices, setDevices]         = useState<MidiDevice[]>([])
  const [supported, setSupported]     = useState<boolean | null>(null)
  const [permissionDenied, setDenied] = useState(false)

  const onNoteOnRef  = useRef(onNoteOn)
  const onNoteOffRef = useRef(onNoteOff)
  onNoteOnRef.current  = onNoteOn
  onNoteOffRef.current = onNoteOff

  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) {
      setSupported(false)
      return
    }
    setSupported(true)

    let access: MIDIAccess | null = null

    // Arrow function so `this` isn't typed — avoids MIDIInput `this` param issues.
    const onMsg = (ev: MIDIMessageEvent) => {
      const d = ev.data
      if (!d || d.length < 3) return
      const status = d[0]
      const note   = d[1]
      const vel    = d[2]
      const type   = status & 0xf0
      if (type === 0x90 && vel > 0)                           onNoteOnRef.current(note)
      else if (type === 0x80 || (type === 0x90 && vel === 0)) onNoteOffRef.current(note)
    }

    function bindAll(acc: MIDIAccess) {
      const list: MidiDevice[] = []
      for (const input of acc.inputs.values()) {
        // Remove first to avoid duplicate listeners on reconnect.
        input.removeEventListener('midimessage', onMsg)
        input.addEventListener('midimessage', onMsg)
        list.push({ id: input.id, name: input.name ?? 'MIDI Device' })
      }
      setDevices(list)
    }

    navigator.requestMIDIAccess({ sysex: false })
      .then((acc) => {
        access = acc
        bindAll(acc)
        acc.onstatechange = () => bindAll(acc)
      })
      .catch(() => setDenied(true))

    return () => {
      if (access) {
        access.onstatechange = null
        for (const input of access.inputs.values()) {
          input.removeEventListener('midimessage', onMsg)
        }
      }
    }
  }, [])

  return { devices, supported, permissionDenied }
}
