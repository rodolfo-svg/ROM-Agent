import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Clock,
  BarChart3,
  FileText
} from 'lucide-react';

interface Suggestion {
  id: string;
  component: 'customInstructions' | 'formattingMethod' | 'versioningMethod';
  type: 'add' | 'modify' | 'remove';
  priority: 'high' | 'medium' | 'low';
  problem: string;
  suggestedText: string;
  justification: string;
  affectedMetric: string;
  expectedImprovement: string;
  status?: 'pending' | 'applied' | 'rejected';
}

const componentNames = {
  customInstructions: 'Custom Instructions Gerais',
  formattingMethod: 'Método de Formatação',
  versioningMethod: 'Método de Versionamento e Redação'
};

const priorityColors = {
  high: 'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300'
};

const priorityLabels = {
  high: 'Alta Prioridade',
  medium: 'Média Prioridade',
  low: 'Baixa Prioridade'
};

const typeLabels = {
  add: 'Adicionar',
  modify: 'Modificar',
  remove: 'Remover'
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/custom-instructions/rom/suggestions', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar sugestões');
      }

      const result = await response.json();
      if (result.success) {
        setSuggestions(result.suggestions || []);
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      showMessage('error', 'Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (suggestionId: string) => {
    if (!confirm('Deseja aplicar esta sugestão? As Custom Instructions serão atualizadas.')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/custom-instructions/rom/suggestions/${suggestionId}/apply`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );

      const result = await response.json();

      if (result.success) {
        showMessage('success', 'Sugestão aplicada com sucesso!');
        fetchSuggestions();
      } else {
        showMessage('error', result.error || 'Erro ao aplicar sugestão');
      }
    } catch (error) {
      console.error('Erro ao aplicar sugestão:', error);
      showMessage('error', 'Erro ao aplicar sugestão');
    }
  };

  const handleReject = async (suggestionId: string) => {
    try {
      const response = await fetch(
        `/api/custom-instructions/rom/suggestions/${suggestionId}/reject`,
        {
          method: 'POST',
          credentials: 'include'
        }
      );

      const result = await response.json();

      if (result.success) {
        showMessage('success', 'Sugestão rejeitada');
        fetchSuggestions();
      } else {
        showMessage('error', result.error || 'Erro ao rejeitar sugestão');
      }
    } catch (error) {
      console.error('Erro ao rejeitar sugestão:', error);
      showMessage('error', 'Erro ao rejeitar sugestão');
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!confirm('Deseja executar uma análise agora? Isso pode levar alguns minutos.')) {
      return;
    }

    try {
      setAnalyzing(true);
      const response = await fetch(
        '/api/custom-instructions/rom/trigger-analysis',
        {
          method: 'POST',
          credentials: 'include'
        }
      );

      const result = await response.json();

      if (result.success) {
        showMessage('success', `Análise concluída! ${result.suggestionsCount} sugestão(ões) gerada(s)`);
        fetchSuggestions();
      } else {
        showMessage('error', result.error || 'Erro ao executar análise');
      }
    } catch (error) {
      console.error('Erro ao executar análise:', error);
      showMessage('error', 'Erro ao executar análise');
    } finally {
      setAnalyzing(false);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending' || !s.status);
  const highPriority = pendingSuggestions.filter(s => s.priority === 'high');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-gray-600">Carregando sugestões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            Sugestões de IA
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Melhorias sugeridas com base em análise de uso
          </p>
        </div>

        <button
          onClick={handleTriggerAnalysis}
          disabled={analyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analisando...' : 'Executar Análise'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Stats */}
      {pendingSuggestions.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Total Pendente</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{pendingSuggestions.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Alta Prioridade</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{highPriority.length}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Análise Periódica</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">Semanal / Mensal</p>
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {pendingSuggestions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Nenhuma sugestão pendente no momento.</p>
          <p className="text-sm text-gray-500 mt-2">
            Execute uma análise manual ou aguarde a análise periódica.
          </p>
          <button
            onClick={handleTriggerAnalysis}
            disabled={analyzing}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analisando...' : 'Executar Análise Agora'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">
                        {componentNames[suggestion.component]}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded border ${priorityColors[suggestion.priority]}`}>
                        {priorityLabels[suggestion.priority]}
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 border border-gray-300">
                        {typeLabels[suggestion.type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{suggestion.problem}</p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApply(suggestion.id)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aplicar
                    </button>
                    <button
                      onClick={() => handleReject(suggestion.id)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Suggested Text */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 mb-2 flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    Texto Sugerido:
                  </h4>
                  <div className="bg-blue-50 p-3 rounded text-sm text-gray-800 border border-blue-200">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {suggestion.suggestedText}
                    </pre>
                  </div>
                </div>

                {/* Justification */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 mb-2">Justificativa:</h4>
                  <p className="text-sm text-gray-700">{suggestion.justification}</p>
                </div>

                {/* Expected Improvement */}
                <div className="flex items-start gap-2 p-3 bg-green-50 rounded border border-green-200">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-900 mb-1">
                      Melhoria Esperada em <span className="font-mono">{suggestion.affectedMetric}</span>:
                    </p>
                    <p className="text-sm text-green-800">{suggestion.expectedImprovement}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
