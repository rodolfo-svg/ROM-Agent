import { useState, useEffect } from 'react';
import {
  Save,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  Settings,
  BarChart3,
  History,
  RefreshCw
} from 'lucide-react';

interface Component {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  content: {
    html: string;
    markdown: string;
    text: string;
  };
  metadata: {
    wordCount: number;
    characterCount: number;
    estimatedTokens: number;
  };
}

interface CustomInstructionsData {
  partnerId: string;
  version: string;
  lastUpdated: string;
  updatedBy: string;
  components: {
    customInstructions: Component;
    formattingMethod: Component;
    versioningMethod: Component;
  };
  settings: {
    enforcementLevel: string;
    applyToChat: boolean;
    applyToPecas: boolean;
    allowPartnerOverride: boolean;
    allowUserOverride: boolean;
  };
}

export default function CustomInstructionsPage() {
  const [data, setData] = useState<CustomInstructionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'customInstructions' | 'formattingMethod' | 'versioningMethod'>('customInstructions');
  const [showPreview, setShowPreview] = useState(false);
  const [compiledPreview, setCompiledPreview] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    fetchData();
    fetchVersions();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/custom-instructions/rom', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar Custom Instructions');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar custom instructions:', error);
      showMessage('error', 'Erro ao carregar Custom Instructions');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const response = await fetch('/api/custom-instructions/rom/versions', {
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setVersions(result.versions || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar versões:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    if (!data) return;

    setSaving(true);
    try {
      const response = await fetch('/api/custom-instructions/rom', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          components: data.components,
          settings: data.settings
        })
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        showMessage('success', 'Custom Instructions salvas com sucesso!');
        fetchVersions();
      } else {
        showMessage('error', result.error || 'Erro ao salvar');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showMessage('error', 'Erro ao salvar Custom Instructions');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const response = await fetch('/api/custom-instructions/rom/preview', {
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        setCompiledPreview(result.compiledText);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      showMessage('error', 'Erro ao gerar preview');
    }
  };

  const handleTextChange = (text: string) => {
    if (!data) return;

    const updatedData = { ...data };
    updatedData.components[activeTab].content.text = text;

    // Recalcula metadados
    updatedData.components[activeTab].metadata = {
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      characterCount: text.length,
      estimatedTokens: Math.ceil(text.length / 4)
    };

    setData(updatedData);
  };

  const handleToggleSetting = (setting: keyof CustomInstructionsData['settings']) => {
    if (!data) return;

    setData({
      ...data,
      settings: {
        ...data.settings,
        [setting]: !data.settings[setting]
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-gray-600">Carregando Custom Instructions...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>Erro ao carregar Custom Instructions</p>
        </div>
      </div>
    );
  }

  const activeComponent = data.components[activeTab];
  const totalTokens = Object.values(data.components).reduce(
    (sum, c) => sum + (c.metadata?.estimatedTokens || 0), 0
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Custom Instructions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configurações globais aplicadas a todas as peças jurídicas
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Histórico ({versions.length})
          </button>

          <button
            onClick={handlePreview}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview Compilado
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Info Card */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-900">
              <strong>Sequência de Aplicação:</strong> 1º Custom Instructions →
              2º Formatação → 3º Versionamento → 4º Prompt Específico da Peça
            </p>
            <p className="text-xs text-blue-700 mt-2 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Versão: <span className="font-semibold">{data.version}</span>
              </span>
              <span>•</span>
              <span>
                Última atualização: {new Date(data.lastUpdated).toLocaleString('pt-BR')} por {data.updatedBy}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                Total: <span className="font-semibold">{totalTokens} tokens</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { id: 'customInstructions', label: '1. Custom Instructions', icon: FileText },
            { id: 'formattingMethod', label: '2. Formatação', icon: Settings },
            { id: 'versioningMethod', label: '3. Versionamento', icon: History }
          ].map(({ id, label, icon: Icon }) => {
            const component = data.components[id as keyof typeof data.components];
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`px-4 py-3 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                  activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {component.metadata.estimatedTokens} tokens
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{activeComponent.name}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {activeTab === 'customInstructions' && 'Instruções base aplicadas a todas as conversas e peças'}
            {activeTab === 'formattingMethod' && 'Regras ABNT/OAB de formatação para peças jurídicas'}
            {activeTab === 'versioningMethod' && 'Técnicas de redação persuasiva e metodologia'}
          </p>
        </div>

        <div className="p-4">
          <textarea
            value={activeComponent.content.text}
            onChange={(e) => handleTextChange(e.target.value)}
            className="w-full h-96 p-4 font-mono text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder="Digite o conteúdo aqui..."
          />

          {/* Stats */}
          <div className="mt-4 flex gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              Palavras: <span className="font-semibold">{activeComponent.metadata.wordCount}</span>
            </span>
            <span className="flex items-center gap-1">
              Caracteres: <span className="font-semibold">{activeComponent.metadata.characterCount}</span>
            </span>
            <span className="flex items-center gap-1">
              Tokens estimados: <span className="font-semibold">{activeComponent.metadata.estimatedTokens}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurações de Aplicação</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.settings.applyToChat}
              onChange={() => handleToggleSetting('applyToChat')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Aplicar em conversas de chat</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.settings.applyToPecas}
              onChange={() => handleToggleSetting('applyToPecas')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Aplicar em geração de peças</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.settings.allowUserOverride}
              onChange={() => handleToggleSetting('allowUserOverride')}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Permitir que usuários desabilitem (override)</span>
          </label>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Preview Compilado</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Eye className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded font-mono">
                {compiledPreview}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Versions Panel */}
      {showVersions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Histórico de Versões</h2>
              <button
                onClick={() => setShowVersions(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Eye className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-auto">
              {versions.length === 0 ? (
                <p className="text-gray-600 text-center py-4">Nenhuma versão anterior</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.version}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-900">v{version.version}</span>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Date(version.date).toLocaleString('pt-BR')}
                          </p>
                          <p className="text-xs text-gray-500">por {version.updatedBy}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
