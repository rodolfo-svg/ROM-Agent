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

  const handleDownloadTxt = () => {
    const ext = getArtifactExtension(activeArtifact.type, activeArtifact.language)
    downloadFile(activeArtifact.content, `${activeArtifact.title}.${ext}`, 'text/plain')
    setShowDownloadMenu(false)
  }

  const handleDownloadDocx = async () => {
    try {
      const response = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeArtifact.content,
          title: activeArtifact.title,
          type: 'artifact',
          metadata: {
            type: activeArtifact.type,
            language: activeArtifact.language,
            createdAt: activeArtifact.createdAt,
            author: 'ROM Agent'
          },
          template: 'oab' // Formatação OAB/ABNT
        })
      })

      if (!response.ok) throw new Error('Erro ao gerar DOCX')

      const blob = await response.blob()
      saveAs(blob, `${activeArtifact.title}.docx`)
      setShowDownloadMenu(false)
    } catch (err) {
      console.error('Error creating DOCX:', err)

      // Fallback para geração cliente
      try {
        const doc = new Document({
          sections: [{
            properties: {},
            children: activeArtifact.content.split('\n').map(line =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 24 })],
                spacing: { after: 200 },
              })
            ),
          }],
        })

        const blob = await Packer.toBlob(doc)
        saveAs(blob, `${activeArtifact.title}.docx`)
        setShowDownloadMenu(false)
      } catch (fallbackErr) {
        console.error('Fallback DOCX also failed:', fallbackErr)
        handleDownloadTxt()
      }
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeArtifact.content,
          title: activeArtifact.title,
          type: 'artifact',
          metadata: {
            type: activeArtifact.type,
            language: activeArtifact.language,
            createdAt: activeArtifact.createdAt,
            author: 'ROM Agent'
          },
          template: 'oab'
        })
      })

      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      saveAs(blob, `${activeArtifact.title}.pdf`)
      setShowDownloadMenu(false)
    } catch (err) {
      console.error('Error creating PDF:', err)
      alert('Erro ao gerar PDF. Tente outro formato.')
    }
  }

  const handleDownloadHTML = async () => {
    try {
      const response = await fetch('/api/export/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeArtifact.content,
          title: activeArtifact.title,
          type: 'artifact',
          metadata: {
            type: activeArtifact.type,
            language: activeArtifact.language,
            createdAt: activeArtifact.createdAt,
            author: 'ROM Agent'
          },
          template: 'oab'
        })
      })

      if (!response.ok) throw new Error('Erro ao gerar HTML')

      const html = await response.text()
      const blob = new Blob([html], { type: 'text/html' })
      saveAs(blob, `${activeArtifact.title}.html`)
      setShowDownloadMenu(false)
    } catch (err) {
      console.error('Error creating HTML:', err)
      alert('Erro ao gerar HTML. Tente outro formato.')
    }
  }

  const handleDownloadMarkdown = async () => {
    try {
      const response = await fetch('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: activeArtifact.content,
          title: activeArtifact.title,
          type: 'artifact',
          metadata: {
            type: activeArtifact.type,
            language: activeArtifact.language,
            createdAt: activeArtifact.createdAt,
            author: 'ROM Agent'
          }
        })
      })

      if (!response.ok) throw new Error('Erro ao gerar Markdown')

      const markdown = await response.text()
      const blob = new Blob([markdown], { type: 'text/markdown' })
      saveAs(blob, `${activeArtifact.title}.md`)
      setShowDownloadMenu(false)
    } catch (err) {
      console.error('Error creating Markdown:', err)
      alert('Erro ao gerar Markdown. Tente outro formato.')
    }
  }

  // Mobile sempre fullscreen, desktop respeitando isFullscreen
  const panelWidth = isFullscreen ? 'w-[70%] max-md:w-full' : 'w-[50%] max-w-[700px] max-md:w-full'

  return (
    <div
      className={cn(
        panelWidth,
        'h-screen bg-white border-l border-stone-200 flex flex-col',
        'animate-slide-in-right',
        'max-md:fixed max-md:right-0 max-md:top-0 max-md:z-50'
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-stone-500">{getIcon()}</div>
          <div>
            <h2 className="text-sm font-medium text-stone-800">
              {activeArtifact.title}
            </h2>
            <span className="text-xs text-stone-400">
              {activeArtifact.type === 'document' ? 'Documento' : 
               activeArtifact.type === 'code' ? `Código ${activeArtifact.language || ''}` :
               activeArtifact.type === 'table' ? 'Tabela' : 
               activeArtifact.type === 'html' ? 'HTML' : 'Gráfico'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Actions */}
          <div className="flex items-center gap-1 mr-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors"
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
            className="p-2 hover:bg-stone-100 rounded-lg text-stone-500"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={closePanel}
            className="p-2 hover:bg-stone-100 rounded-lg text-stone-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 bg-stone-50 border-b border-stone-200 flex gap-1">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === 'preview' 
              ? 'bg-white text-stone-800 shadow-sm' 
              : 'text-stone-500 hover:text-stone-700'
          )}
        >
          Visualizar
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            activeTab === 'code' 
              ? 'bg-white text-stone-800 shadow-sm' 
              : 'text-stone-500 hover:text-stone-700'
          )}
        >
          Código
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-mono text-sm text-stone-800 resize-none focus:outline-none focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10"
          />
        ) : activeTab === 'code' ? (
          <pre className="font-mono text-sm leading-relaxed">
            {activeArtifact.content.split('\n').map((line, i) => (
              <div key={i} className="flex hover:bg-stone-50 -mx-4 px-4">
                <span className="w-10 text-right pr-4 text-stone-400 select-none">
                  {i + 1}
                </span>
                <span className="text-stone-800 flex-1">{line || ' '}</span>
              </div>
            ))}
          </pre>
        ) : (
          <div className="prose-chat">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800">
              {activeArtifact.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
