import { Sparkles } from 'lucide-react'

interface EmptyStateProps {
  onSuggestionClick?: (message: string) => void
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 animate-fade-in">
      {/* Logo */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-bronze-400 to-bronze-600 flex items-center justify-center mb-8 shadow-lg">
        <Sparkles className="w-10 h-10 text-white" />
      </div>

      {/* Title */}
      <h1 className="text-3xl font-semibold text-stone-800 mb-3">
        ROM Agent
      </h1>
      <p className="text-stone-500 text-center max-w-md mb-4">
        Redator de Obras Magistrais
      </p>
      <p className="text-stone-400 text-sm text-center max-w-lg mb-12">
        Peças jurídicas com excelência técnica e metodologia ROM.
        <br />
        Digite sua solicitação abaixo para começar.
      </p>

      {/* Features */}
      <div className="flex items-center gap-6 text-xs text-stone-400">
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
