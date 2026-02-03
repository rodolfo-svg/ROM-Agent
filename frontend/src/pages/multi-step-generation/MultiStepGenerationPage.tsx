import React, { useState } from 'react';
import { AlertCircle, FileText, Clock, CheckCircle, Loader2, Download } from 'lucide-react';

interface Step {
  step: number;
  pages: number;
  estimatedMinutes: number;
  section: string;
}

interface StepResult {
  step: number;
  pages: number;
  success: boolean;
  elapsedSeconds: number;
  characterCount: number;
  estimatedTokens: number;
}

export function MultiStepGenerationPage() {
  const [totalPages, setTotalPages] = useState(40);
  const [documentType, setDocumentType] = useState('petição inicial');
  const [theme, setTheme] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<any>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlan() {
    setIsPlanning(true);
    setError(null);

    try {
      const response = await fetch('/api/generate/multi-step/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentType,
          totalPages
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao planejar geração');
      }

      setPlan(data);

    } catch (err: any) {
      console.error('Erro no planejamento:', err);
      setError(err.message || 'Erro ao planejar geração');
    } finally {
      setIsPlanning(false);
    }
  }

  async function handleGenerate() {
    if (!theme.trim()) {
      setError('Por favor, informe o tema do documento');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setStepResults([]);
    setProgress(0);
    setCurrentStep(0);

    try {
      const response = await fetch('/api/generate/multi-step/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentType,
          theme,
          totalPages,
          partnerId: 'rom',
          additionalInstructions
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar documento');
      }

      setResult(data);
      setStepResults(data.stepResults || []);
      setProgress(100);

    } catch (err: any) {
      console.error('Erro na geração:', err);
      setError(err.message || 'Erro ao gerar documento');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!result || !result.document) return;

    const blob = new Blob([result.document], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documento-${totalPages}pag-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900">
          Geração Multi-Step
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Para documentos grandes (&gt;35 páginas)
        </p>
      </div>

      {/* Warning */}
      {totalPages > 35 && !plan && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>Geração Multi-Etapa:</strong> Documentos acima de 35 páginas
              são gerados em múltiplas etapas. Clique em "Planejar" para ver quantas
              etapas serão necessárias.
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Tipo de Documento
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                >
                  <option value="petição inicial">Petição Inicial</option>
                  <option value="contestação">Contestação</option>
                  <option value="recurso de apelação">Recurso de Apelação</option>
                  <option value="parecer jurídico">Parecer Jurídico</option>
                  <option value="memoriale">Memorial</option>
                  <option value="embargos de declaração">Embargos de Declaração</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Tema (resumido)
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex: responsabilidade civil por danos de R$ 5M"
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Total de Páginas
                </label>
                <input
                  type="number"
                  value={totalPages}
                  onChange={(e) => setTotalPages(Number(e.target.value))}
                  min={36}
                  max={100}
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                />
                <p className="text-xs text-stone-500 mt-1">
                  Mínimo: 36 páginas (até 35 use geração normal)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Instruções Adicionais (opcional)
                </label>
                <textarea
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="Ex: Incluir análise de precedentes do STJ, enfatizar danos morais..."
                  className="w-full border border-stone-300 rounded-lg p-2.5 text-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePlan}
                  disabled={isPlanning || isGenerating || totalPages <= 35}
                  className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPlanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Planejando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Planejar
                    </>
                  )}
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !theme || totalPages <= 35}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Gerar Documento
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Plan/Progress/Results */}
            <div className="space-y-4">
              {/* Plan */}
              {plan && !isGenerating && !result && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-3">
                    Plano de Geração
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p>
                      <strong>Total de etapas:</strong> {plan.totalSteps}
                    </p>
                    <p>
                      <strong>Tempo estimado:</strong> ~{plan.estimatedMinutes} minutos
                    </p>
                    <div className="mt-3 space-y-2">
                      {plan.steps?.map((step: Step) => (
                        <div
                          key={step.step}
                          className="bg-white/50 rounded p-2 text-xs"
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">
                              Etapa {step.step}:
                            </span>
                            <span>{step.pages} páginas</span>
                          </div>
                          <div className="text-blue-700 mt-1">
                            {step.section}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isGenerating && (
                <div className="bg-white border border-stone-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <h3 className="font-semibold text-stone-900">
                      Gerando Documento...
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm text-stone-600 mb-1">
                        <span>Progresso geral</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {stepResults.length > 0 && (
                      <div className="space-y-2 mt-4">
                        {stepResults.map((stepResult) => (
                          <div
                            key={stepResult.step}
                            className="flex items-center gap-2 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-stone-700">
                              Etapa {stepResult.step} concluída - {stepResult.pages} páginas ({stepResult.elapsedSeconds}s)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900">
                        Documento Gerado com Sucesso!
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        {result.message}
                      </p>
                    </div>
                  </div>

                  {result.statistics && (
                    <div className="bg-white/50 rounded p-3 space-y-1 text-sm text-green-800 mb-4">
                      <div className="flex justify-between">
                        <span>Total de páginas:</span>
                        <span className="font-medium">{result.statistics.totalPages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Etapas concluídas:</span>
                        <span className="font-medium">{result.statistics.totalSteps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tempo total:</span>
                        <span className="font-medium">~{result.statistics.totalTimeMinutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Caracteres:</span>
                        <span className="font-medium">{result.statistics.totalCharacters.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tokens estimados:</span>
                        <span className="font-medium">{result.statistics.estimatedTokens.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleDownload}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Documento
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-red-900">Erro</h3>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-6 bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h3 className="font-semibold text-stone-900 mb-2">
          Como Funciona
        </h3>
        <div className="text-sm text-stone-700 space-y-2">
          <p>
            <strong>Limite em passe único:</strong> 35 páginas (validado em testes)
          </p>
          <p>
            <strong>Multi-Step:</strong> Para documentos &gt;35 páginas, o sistema divide
            automaticamente em etapas de 20 páginas.
          </p>
          <p>
            <strong>Exemplo:</strong> Documento de 40 páginas = 2 etapas (20 + 20 páginas)
          </p>
          <p className="text-xs text-stone-600 mt-3">
            Tempo estimado: ~12 minutos por etapa de 20 páginas
          </p>
        </div>
      </div>
    </div>
  );
}
