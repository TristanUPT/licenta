import { useEffectsStore } from '@/store/effectsStore'
import {
  EQ_BAND_PARAM,
  EQ_BANDS,
  EQ_DEFINITION,
  EQ_LOW_CUT_PARAM,
  eqParamId,
  type EffectInstance,
  type ParamSchema,
} from '@/types/effects'
import { Knob } from '@/components/controls/Knob'
import { EQCurveDisplay } from '@/components/visualization/EQCurveDisplay'
import { EffectCard } from './EffectCard'

interface ParametricEQProps {
  instance: EffectInstance
}

function findSchema(id: number): ParamSchema {
  const s = EQ_DEFINITION.params.find((p) => p.id === id)
  if (!s) throw new Error(`unknown EQ param ${id}`)
  return s
}

export function ParametricEQ({ instance }: ParametricEQProps) {
  const setParam = useEffectsStore((s) => s.setParam)

  const bands = Array.from({ length: EQ_BANDS }, (_, i) => i)

  const lcEnabled = (instance.params[EQ_LOW_CUT_PARAM.ENABLED] ?? 0) >= 0.5
  const lcSlope   = Math.round(instance.params[EQ_LOW_CUT_PARAM.SLOPE] ?? 1)

  return (
    <EffectCard instance={instance}>
      <div className="mb-3 w-full">
        <EQCurveDisplay
          instance={instance}
          onParamChange={(paramId, value) => setParam(instance.id, paramId, value)}
        />
      </div>

      {/* ── Low Cut strip — X32 style ── */}
      <div className={`mb-3 w-full rounded-lg border px-4 py-3 transition ${
        lcEnabled
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-zinc-800 bg-zinc-950/30'
      }`}>
        <div className="flex items-center gap-4">
          {/* Toggle */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Low Cut
            </span>
            <button
              onClick={() => setParam(instance.id, EQ_LOW_CUT_PARAM.ENABLED, lcEnabled ? 0 : 1)}
              className={`h-8 w-14 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                lcEnabled
                  ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40 hover:bg-orange-500/30'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              {lcEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Frequency knob */}
          <div className={`transition ${lcEnabled ? '' : 'pointer-events-none opacity-40'}`}>
            <Knob
              schema={findSchema(EQ_LOW_CUT_PARAM.FREQ)}
              value={instance.params[EQ_LOW_CUT_PARAM.FREQ] ?? findSchema(EQ_LOW_CUT_PARAM.FREQ).default}
              onChange={(v) => setParam(instance.id, EQ_LOW_CUT_PARAM.FREQ, v)}
              effectType={instance.type}
            />
          </div>

          {/* Slope selector */}
          <div className={`flex flex-col gap-1 transition ${lcEnabled ? '' : 'pointer-events-none opacity-40'}`}>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              dB/oct
            </span>
            {([1, 2] as const).map((s) => (
              <button
                key={s}
                onClick={() => setParam(instance.id, EQ_LOW_CUT_PARAM.SLOPE, s)}
                className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition ${
                  lcSlope === s
                    ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                }`}
              >
                {s === 1 ? '12' : '24'}
              </button>
            ))}
          </div>

          <div className="ml-2 flex-1 border-l border-zinc-800 pl-4">
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Removes sub-bass content below the cutoff.{' '}
              {lcEnabled
                ? `Active at ${(instance.params[EQ_LOW_CUT_PARAM.FREQ] ?? 80).toFixed(0)} Hz, ${lcSlope === 1 ? '12' : '24'} dB/oct.`
                : 'Disabled.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-4 gap-3">
        {bands.map((bandIdx) => {
          const enabledId = eqParamId(bandIdx, EQ_BAND_PARAM.ENABLED)
          const typeId = eqParamId(bandIdx, EQ_BAND_PARAM.TYPE)
          const freqId = eqParamId(bandIdx, EQ_BAND_PARAM.FREQ)
          const gainId = eqParamId(bandIdx, EQ_BAND_PARAM.GAIN)
          const qId = eqParamId(bandIdx, EQ_BAND_PARAM.Q)
          const enabled = (instance.params[enabledId] ?? 0) >= 0.5
          const typeValue = instance.params[typeId] ?? 0
          const typeSchema = findSchema(typeId)
          const typeLabel = typeSchema.options?.find(
            (o) => o.value === Math.round(typeValue),
          )?.label ?? '—'

          return (
            <div
              key={bandIdx}
              className={`rounded-lg border p-3 transition ${
                enabled
                  ? 'border-zinc-700 bg-zinc-950/40'
                  : 'border-zinc-800/60 bg-zinc-950/20 opacity-60'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => setParam(instance.id, enabledId, enabled ? 0 : 1)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    enabled
                      ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                  }`}
                >
                  Band {bandIdx + 1}
                </button>
                <select
                  value={Math.round(typeValue)}
                  onChange={(e) => setParam(instance.id, typeId, Number(e.target.value))}
                  className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300 focus:border-purple-500 focus:outline-none"
                  aria-label={`Band ${bandIdx + 1} filter type — current: ${typeLabel}`}
                >
                  {typeSchema.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-around">
                <Knob
                  schema={findSchema(freqId)}
                  value={instance.params[freqId] ?? findSchema(freqId).default}
                  onChange={(v) => setParam(instance.id, freqId, v)}
                  effectType={instance.type}
                />
                <Knob
                  schema={findSchema(gainId)}
                  value={instance.params[gainId] ?? findSchema(gainId).default}
                  onChange={(v) => setParam(instance.id, gainId, v)}
                  effectType={instance.type}
                />
                <Knob
                  schema={findSchema(qId)}
                  value={instance.params[qId] ?? findSchema(qId).default}
                  onChange={(v) => setParam(instance.id, qId, v)}
                  effectType={instance.type}
                />
              </div>
            </div>
          )
        })}
      </div>
    </EffectCard>
  )
}
