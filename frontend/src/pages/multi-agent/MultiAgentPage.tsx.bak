import { useState } from 'react'
import { Sidebar } from '@/components/layout'
import { Workflow, Play, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { Button } from '@/components/ui'

interface PipelineStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  output?: string
}

export function MultiAgentPage() {
  const [document, setDocument] = useState('')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [running, setRunning] = useState(false)

  const handleRunPipeline = async () => {
    if (!document.trim()) return

    setRunning(true)
    setSteps([
      { id: '1', name: 'Análise Preliminar', status: 'running' },
      { id: '2', name: 'Extração de Dados', status: 'pending' },
      { id: '3', name: 'Análise Jurídica', status: 'pending' },
      { id: '4', name: 'Geração de Documento', status: 'pending' },
    ])

    try {
      const response = await fetch('/api/multi-agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document, steps: ['analyze', 'extract', 'legal', 'generate'] }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let stepIndex = 0

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'step_complete') {
              setSteps(prev => prev.map((s, idx) => {
                if (idx === stepIndex) {
                  return { ...s, status: 'completed', output: data.output }
                } else if (idx === stepIndex + 1) {
                  return { ...s, status: 'running' }
                }
                return s
              }))
              stepIndex++
            }
          }
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error)
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-screen flex bg-stone-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-8 py-6">
          <h1 className="text-2xl font-semibold text-stone-800 mb-2">Multi-Agent Pipeline</h1>
          <p className="text-stone-500">Processamento avançado com múltiplos agentes especializados</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Input */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <label className="block text-sm font-medium text-stone-700 mb-3">
                Documento ou Texto
              </label>
              <textarea
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Cole o texto do documento aqui..."
                rows={8}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-bronze-400/30 focus:border-bronze-400 resize-none"
              />
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleRunPipeline}
                  disabled={!document.trim() || running}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  {running ? 'Processando...' : 'Executar Pipeline'}
                </Button>
              </div>
            </div>

            {/* Pipeline Steps */}
            {steps.length > 0 && (
              <div className="bg-white rounded-xl shadow-soft p-6">
                <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-bronze-500" />
                  Progresso do Pipeline
                </h2>

                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {step.status === 'running' && (
                          <Loader className="w-5 h-5 text-bronze-500 animate-spin" />
                        )}
                        {step.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        {step.status === 'pending' && (
                          <div className="w-5 h-5 rounded-full border-2 border-stone-300" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-stone-800">{step.name}</span>
                          <span className="text-xs text-stone-500 capitalize">{step.status}</span>
                        </div>

                        {step.output && (
                          <div className="mt-2 p-3 bg-stone-50 rounded-lg">
                            <p className="text-sm text-stone-600">{step.output}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
