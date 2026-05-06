import { useEffectsStore } from '@/store/effectsStore'
import { SATURATION_DEFINITION, SATURATION_PARAM, type EffectInstance, type ParamSchema } from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { EffectCard } from './EffectCard'

interface SaturationProps { instance: EffectInstance }

function findSchema(id: number): ParamSchema {
  const s = SATURATION_DEFINITION.params.find((p) => p.id === id)
  if (!s) throw new Error(`unknown saturation param ${id}`)
  return s
}

export function Saturation({ instance }: SaturationProps) {
  const setParam = useEffectsStore((s) => s.setParam)
  const typeSchema = findSchema(SATURATION_PARAM.TYPE)
  const typeValue = Math.round(instance.params[SATURATION_PARAM.TYPE] ?? typeSchema.default)

  return (
    <EffectCard instance={instance}>
      {SATURATION_DEFINITION.params.map((schema) => {
        if (schema.id === SATURATION_PARAM.TYPE) {
          return (
            <div key={schema.id} className="flex flex-col items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-zinc-400">{schema.label}</span>
              <select
                value={typeValue}
                onChange={(e) => setParam(instance.id, schema.id, Number(e.target.value))}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
              >
                {schema.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {schema.options?.find((o) => o.value === typeValue)?.label ?? '—'}
              </span>
            </div>
          )
        }
        return (
          <Knob
            key={schema.id}
            schema={schema}
            value={instance.params[schema.id] ?? schema.default}
            onChange={(v) => setParam(instance.id, schema.id, v)}
            effectType={instance.type}
          />
        )
      })}
    </EffectCard>
  )
}
