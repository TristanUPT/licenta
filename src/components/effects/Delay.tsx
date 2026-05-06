import { useEffectsStore } from '@/store/effectsStore'
import { DELAY_DEFINITION, type EffectInstance } from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { EffectCard } from './EffectCard'

interface DelayProps { instance: EffectInstance }

export function Delay({ instance }: DelayProps) {
  const setParam = useEffectsStore((s) => s.setParam)
  return (
    <EffectCard instance={instance}>
      {DELAY_DEFINITION.params.map((schema) => (
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
