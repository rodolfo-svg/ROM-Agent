import { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Download,
  Edit3,
  Save,
  FileText,
  Code,
  FileCode,
  Table,
  BarChart3,
  Check,
  Maximize2,
  Minimize2,
  ChevronDown
} from 'lucide-react'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import { useArtifactStore } from '@/stores/artifactStore'
import { cn, copyToClipboard, downloadFile, getArtifactExtension } from '@/utils'
import type { Artifact } from '@/types'

export function ArtifactPanel() {
  const { 
    activeArtifactId,
    artifacts,
    isPanelOpen, 
    isFullscreen,
    closePanel, 
    updateArtifact,
    toggleFullscreen
  } = useArtifactStore()

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId)

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  useEffect(() => {
    if (activeArtifact) {
      setEditContent(activeArtifact.content)
    }
  }, [activeArtifact?.id])

  // Debug: Log render state
  useEffect(() => {
    console.log('🎨 [ArtifactPanel] Render state:', {
      isPanelOpen,
      hasActiveArtifact: !!activeArtifact,
      activeArtifactId,
      totalArtifacts: artifacts.length,
      willRender: isPanelOpen && !!activeArtifact
    })
  }, [isPanelOpen, activeArtifact, activeArtifactId, artifacts.length])

  if (!isPanelOpen || !activeArtifact) {
    console.log('❌ [ArtifactPanel] Not rendering. isPanelOpen:', isPanelOpen, 'activeArtifact:', !!activeArtifact)
    return null
  }

  console.log('✅ [ArtifactPanel] Rendering panel for artifact:', activeArtifact.title)

  const getIcon = () => {
    const icons = {
      document: FileText,
      code: Code,
      table: Table,
      chart: BarChart3,
      html: Code,
    }
    const Icon = icons[activeArtifact.type] || FileText
    return <Icon className="w-[18px] h-[18px]" />
  }

  const handleEdit = () => {
    setEditContent(activeArtifact.content)
    setIsEditing(true)
  }

  const handleSave = () => {
    updateArtifact(activeArtifact.id, editContent)
    setIsEditing(false)
  }

  const handleCopy = async () => {
    await copyToClipboard(activeArtifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTxt = () => handleDownloadFormat('txt')

  // Fase 2: Download em qualquer formato usando novo conversor
  const handleDownloadFormat = async (format: 'docx' | 'pdf' | 'html' | 'txt' | 'md') => {
    try {
      console.log(`[ArtifactPanel] Downloading as ${format.toUpperCase()}`)

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeArtifact.content,
          format: format,
          title: activeArtifact.title,
          filename: activeArtifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
          author: 'ROM Agent'
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || `Erro ao gerar ${format.toUpperCase()}`)
      }

      const blob = await response.blob()
      const fileExtensions: Record<string, string> = {
        docx: '.docx',
        pdf: '.pdf',
        html: '.html',
        txt: '.txt',
        md: '.md'
      }

      const filename = `${activeArtifact.title}${fileExtensions[format]}`
      saveAs(blob, filename)
      setShowDownloadMenu(false)

      console.log(`[ArtifactPanel] ✅ Downloaded as ${format.toUpperCase()}: ${filename}`)
    } catch (err: any) {
      console.error(`[ArtifactPanel] ❌ Error downloading ${format}:`, err)
      alert(`Erro ao gerar ${format.toUpperCase()}: ${err.message}`)
    }
  }

  const handleDownloadDocx = () => handleDownloadFormat('docx')

  const handleDownloadPDF = () => handleDownloadFormat('pdf')
  const handleDownloadHTML = () => handleDownloadFormat('html')
  const handleDownloadMarkdown = () => handleDownloadFormat('md')

  // Mobile sempre fullscreen, desktop respeitando isFullscreen
  const panelWidth = isFullscreen ? 'w-[70%] max-md:w-full' : 'w-[50%] max-w-[700px] max-md:w-full'

  return (
    <div
      className={cn(
        panelWidth,
        'h-screen bg-gradient-to-br from-white via-stone-50/30 to-bronze-50/20 border-l border-stone-200/60 flex flex-col shadow-2xl',
        'animate-slide-in-right',
        'max-md:fixed max-md:right-0 max-md:top-0 max-md:z-50'
      )}
    >
      {/* Header - Modern gradient */}
      <div className="px-4 py-4 border-b border-stone-200/60 bg-gradient-to-r from-bronze-600 via-bronze-700 to-amber-700 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white">
            {getIcon()}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white drop-shadow-sm">
              {activeArtifact.title}
            </h2>
            <span className="text-xs text-white/80 font-medium">
              {activeArtifact.type === 'document' ? 'Documento Jurídico' :
               activeArtifact.type === 'code' ? `Código ${activeArtifact.language || ''}` :
               activeArtifact.type === 'table' ? 'Tabela' :
               activeArtifact.type === 'html' ? 'HTML' : 'Gráfico'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Actions */}
          <div className="flex items-center gap-2 mr-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-bronze-700 rounded-lg text-xs font-semibold hover:bg-white/90 transition-all hover:scale-105 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-medium hover:bg-white/30 transition-all border border-white/20"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-medium hover:bg-white/30 transition-all border border-white/20"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </button>
            
            {/* Download dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-bronze-700 rounded-lg text-xs font-semibold hover:bg-white/90 transition-all hover:scale-105 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDownloadMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg border border-stone-200 shadow-lg z-20 py-1">
                    <button
                      onClick={handleDownloadDocx}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Word (.docx)
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      PDF (.pdf)
                    </button>
                    <button
                      onClick={handleDownloadHTML}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      HTML (.html)
                    </button>
                    <button
                      onClick={handleDownloadMarkdown}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <FileCode className="w-4 h-4" />
                      Markdown (.md)
                    </button>
                    <div className="border-t border-stone-200 my-1" />
                    <button
                      onClick={handleDownloadTxt}
                      className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Texto (.txt)
                    </button>
                    <div className="border-t border-stone-200 my-1" />
                    <div className="px-4 py-2 text-xs text-stone-500">
                      Formatação: ABNT/OAB
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/30 rounded-lg text-white/90 hover:text-white transition-all border border-white/20 backdrop-blur-sm"
            title={isFullscreen ? "Minimizar" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={closePanel}
            className="p-2 hover:bg-white/30 rounded-lg text-white/90 hover:text-white transition-all border border-white/20 backdrop-blur-sm"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs - Modern design */}
      <div className="px-4 py-3 bg-gradient-to-r from-stone-50 to-bronze-50/30 border-b border-stone-200/60 flex gap-2">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
            activeTab === 'preview'
              ? 'bg-gradient-to-r from-bronze-600 to-bronze-700 text-white shadow-md scale-105'
              : 'bg-white/60 text-stone-600 hover:bg-white hover:text-stone-800 hover:scale-105 border border-stone-200/60'
          )}
        >
          📄 Visualizar
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
            activeTab === 'code'
              ? 'bg-gradient-to-r from-bronze-600 to-bronze-700 text-white shadow-md scale-105'
              : 'bg-white/60 text-stone-600 hover:bg-white hover:text-stone-800 hover:scale-105 border border-stone-200/60'
          )}
        >
          💻 Código
        </button>
      </div>

      {/* Content - Enhanced with beautiful styling */}
      <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-white via-transparent to-bronze-50/10">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-5 bg-white border-2 border-bronze-200 rounded-xl font-mono text-sm text-stone-800 resize-none focus:outline-none focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/20 shadow-sm transition-all"
            placeholder="Edite o conteúdo do documento..."
          />
        ) : activeTab === 'code' ? (
          <div className="bg-gradient-to-br from-stone-50 to-stone-100/80 border border-stone-200/60 rounded-xl p-4 shadow-sm">
            <pre className="font-mono text-sm leading-relaxed">
              {activeArtifact.content.split('\n').map((line, i) => (
                <div key={i} className="flex hover:bg-bronze-50/30 -mx-4 px-4 transition-colors">
                  <span className="w-12 text-right pr-4 text-bronze-500/70 select-none font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-stone-800 flex-1">{line || ' '}</span>
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <div className="prose-chat bg-white/60 backdrop-blur-sm border border-stone-200/40 rounded-xl p-6 shadow-sm">
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-stone-800">
              {activeArtifact.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
