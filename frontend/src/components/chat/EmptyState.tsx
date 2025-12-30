import { Sparkles, Scale, FileText, Search, Gavel } from 'lucide-react'

interface EmptyStateProps {
  onSuggestionClick: (message: string) => void
}

const SUGGESTIONS = [
  {
    icon: FileText,
    text: 'Elabore uma petição inicial de indenização por danos morais',
  },
  {
    icon: Scale,
    text: 'Redija um recurso especial sobre violação ao art. 373 do CPC',
  },
  {
    icon: Gavel,
    text: 'Faça um habeas corpus por excesso de prazo na prisão',
  },
  {
    icon: Search,
    text: 'Pesquise jurisprudência do STJ sobre responsabilidade civil objetiva',
  },
]

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 animate-fade-in">
      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-bronze-400 to-bronze-600 flex items-center justify-center mb-6 shadow-lg">
        <Sparkles className="w-8 h-8 text-white" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-semibold text-stone-800 mb-2">
        ROM Agent
      </h1>
      <p className="text-stone-500 text-center max-w-md mb-8">
        Redator de Obras Magistrais. Peças jurídicas com excelência técnica e metodologia ROM.
      </p>

      {/* Suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
        {SUGGESTIONS.map((suggestion, index) => {
          const Icon = suggestion.icon
          return (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="flex items-start gap-3 p-4 text-left bg-white border border-stone-200 rounded-xl hover:border-bronze-400 hover:shadow-medium transition-all group"
            >
              <div className="p-2 bg-stone-100 rounded-lg text-stone-500 group-hover:bg-bronze-100 group-hover:text-bronze-600 transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-stone-600 leading-relaxed">
                {suggestion.text}
              </span>
            </button>
          )
        })}
      </div>

      {/* Features */}
      <div className="flex items-center gap-6 mt-10 text-xs text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          84 agentes especializados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          Jurisprudência integrada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          v4.0 Online
        </span>
      </div>
    </div>
  )
}
