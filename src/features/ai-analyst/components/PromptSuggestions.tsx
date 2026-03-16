'use client'

const SUGGESTIONS = [
  {
    label: 'Estado general',
    prompt: 'Cual es el estado general de la planta hoy?',
  },
  {
    label: 'Peores strings',
    prompt: 'Cuales son los 5 strings con mayor perdida energetica esta semana?',
  },
  {
    label: 'Comparar inversores',
    prompt: 'Compara los inversores INV_01 e INV_02 en los ultimos 7 dias.',
  },
  {
    label: 'Tendencia reciente',
    prompt: 'Como ha evolucionado el rendimiento en los ultimos 30 dias?',
  },
]

interface Props {
  onSelect: (prompt: string) => void
}

export function PromptSuggestions({ onSelect }: Props) {
  return (
    <div className="space-y-3 px-1">
      <p className="text-center text-sm text-gray-400">
        Soy LUCIA, tu analista solar. Preguntame sobre el rendimiento de tu planta.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            className="rounded-xl border border-gray-700/50 bg-gray-800/50 px-3 py-2.5 text-left text-xs text-gray-300 transition-colors hover:border-emerald-500/40 hover:bg-gray-800"
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              {s.label}
            </span>
            <span className="line-clamp-2">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
