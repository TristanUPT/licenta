import { useEffectsStore } from '@/store/effectsStore'
import { CHORUS_DEFINITION, type EffectInstance } from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { EffectCard } from './EffectCard'

export function Chorus({ instance }: { instance: EffectInstance }) {
  const setParam = useEffectsStore((s) => s.setParam)
  return (
    <EffectCard instance={instance}>
      {CHORUS_DEFINITION.params.map((schema) => (
        <Knob
          key={schema.id}
          schema={schema}
          value={instance.params[schema.id] ?? schema.default}
          onChange={(v) => setParam(instance.id, schema.id, v)}
          effectType={instance.type}
        />
      ))}
    </EffectCard>
  )
}
