import { useEffectsStore } from '@/store/effectsStore'
import { COMPRESSOR_DEFINITION, type EffectInstance } from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { GainReductionMeter } from '@/components/visualization/GainReductionMeter'
import { EffectCard } from './EffectCard'

interface CompressorProps {
  instance: EffectInstance
}

export function Compressor({ instance }: CompressorProps) {
  const setParam = useEffectsStore((s) => s.setParam)

  return (
    <EffectCard instance={instance}>
      <GainReductionMeter effectId={instance.id} />
      {COMPRESSOR_DEFINITION.params.map((schema) => (
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
