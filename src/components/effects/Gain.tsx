import { useEffectsStore } from '@/store/effectsStore'
import { GAIN_DEFINITION, type EffectInstance } from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { EffectCard } from './EffectCard'

interface GainProps {
  instance: EffectInstance
}

export function Gain({ instance }: GainProps) {
  const setParam = useEffectsStore((s) => s.setParam)

  return (
    <EffectCard instance={instance}>
      {GAIN_DEFINITION.params.map((schema) => (
        <Knob
          key={schema.id}
          schema={schema}
          value={instance.params[schema.id] ?? schema.default}
          onChange={(v) => setParam(instance.id, schema.id, v)}
        />
      ))}
    </EffectCard>
  )
}
