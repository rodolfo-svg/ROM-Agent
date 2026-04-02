import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FileUp, Layers, X, AlertCircle } from 'lucide-react'

interface VolumeFile {
  file: File
  volumeNumber: number
}

// ✅ FIX: Usar backend direto para chunked uploads (bypass Cloudflare HTTP/2 issues)
const CHUNKED_UPLOAD_BASE_URL = 'https://rom-agent-ia.onrender.com'

export function VolumeUploader({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const [files, setFiles] = useState<VolumeFile[]>([])
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const selectedFiles = Array.from(e.target.files)

    const volumeFiles = selectedFiles.map(file => ({
      file,
      volumeNumber: extractVolumeNumber(file.name)
    }))

    volumeFiles.sort((a, b) => a.volumeNumber - b.volumeNumber)
    setFiles(volumeFiles)
    setError(null)
  }

  const extractVolumeNumber = (filename: string): number => {
    const patterns = [
      /vol[ume]*[\s_-]*(\d+)/i,
      /v[\s_-]*(\d+)/i,
      /parte[\s_-]*(\d+)/i,
      /apenso[\s_-]*(\d+)/i,
      /(\d+)[\s_-]*vol/i,
      /\((\d+)\)/,
      /_(\d+)\./
    ]

    for (const pattern of patterns) {
      const match = filename.match(pattern)
      if (match) return parseInt(match[1])
    }

    return 0
  }

  const handleMergeAndUpload = async () => {
    if (files.length < 2) {
      setError('Selecione pelo menos 2 arquivos para mesclar')
      return
    }

    setMerging(true)
    setError(null)

    try {
      // ✅ DETECTAR SE PRECISA CHUNKED UPLOAD (arquivos >50MB ou soma >80MB)
      const totalSize = files.reduce((acc, f) => acc + f.file.size, 0)
      const hasLargeFile = files.some(f => f.file.size > 50 * 1024 * 1024)
      const CHUNKED_THRESHOLD = 80 * 1024 * 1024 // 80MB

      if (hasLargeFile || totalSize > CHUNKED_THRESHOLD) {
        console.log(`[VolumeUploader] Arquivos grandes detectados (${(totalSize / 1024 / 1024).toFixed(1)} MB), usando CHUNKED UPLOAD`)

        // ✅ FASE 0: Obter token de upload para autenticação cross-origin (v4.0.2)
        console.log('🎫 [VolumeUploader v4.0.2] Obtendo token de upload...')
        const tokenResponse = await fetch('/api/upload/get-upload-token', {
          method: 'GET',
          credentials: 'include', // Usa session cookie normal
        })

        if (!tokenResponse.ok) {
          throw new Error(`Falha ao obter token de upload: ${tokenResponse.status}`)
        }

        const { token: uploadToken } = await tokenResponse.json()
        console.log('✅ [VolumeUploader] Token de upload obtido')

        // ✅ FASE 1: Upload de cada arquivo via chunked
        const uploadedPaths: string[] = []

        for (const { file } of files) {
          console.log(`📦 [VolumeUploader] Uploading: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

          // Iniciar sessão chunked
          const CHUNK_SIZE = 40 * 1024 * 1024 // 40MB
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

          const initResponse = await fetch(`${CHUNKED_UPLOAD_BASE_URL}/api/upload/chunked/init`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${uploadToken}`, // ✅ Usa token JWT
            },
            body: JSON.stringify({
              filename: file.name,
              fileSize: file.size,
              contentType: file.type,
            }),
          })

          if (!initResponse.ok) {
            throw new Error(`Falha ao iniciar chunked upload: ${initResponse.status}`)
          }

          const { uploadId } = await initResponse.json()

          // Upload cada chunk
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, file.size)
            const chunk = file.slice(start, end)

            console.log(`   📤 Chunk ${chunkIndex + 1}/${totalChunks}`)

            const chunkResponse = await fetch(`${CHUNKED_UPLOAD_BASE_URL}/api/upload/chunked/${uploadId}/chunk/${chunkIndex}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${uploadToken}`, // ✅ Usa token JWT
              },
              body: chunk,
            })

            if (!chunkResponse.ok) {
              throw new Error(`Falha no chunk ${chunkIndex}: ${chunkResponse.status}`)
            }
          }

          // Finalizar
          const finalizeResponse = await fetch(`${CHUNKED_UPLOAD_BASE_URL}/api/upload/chunked/${uploadId}/finalize`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${uploadToken}`, // ✅ Usa token JWT
            },
          })

          if (!finalizeResponse.ok) {
            throw new Error(`Falha ao finalizar chunked upload: ${finalizeResponse.status}`)
          }

          const finalResult = await finalizeResponse.json()
          uploadedPaths.push(finalResult.path || finalResult.filePath)
          console.log(`   ✅ Upload completo: ${file.name}`)
        }

        // ✅ FASE 2: Mesclar arquivos já uploadados
        console.log(`[VolumeUploader] Mesclando ${uploadedPaths.length} volumes...`)

        const processName = files[0].file.name.replace(/[_-]?vol.*$/i, '').replace(/\.[^.]+$/, '')

        const mergeResponse = await fetch('/api/kb/merge-volumes/from-paths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            paths: uploadedPaths,
            processName,
          }),
        })

        if (!mergeResponse.ok) {
          // 502/504 = servidor processando ou deploy em andamento
          if (mergeResponse.status === 502 || mergeResponse.status === 504) {
            throw new Error(
              'Servidor está processando ou em manutenção.\n\n' +
              '⏳ Deploy pode estar em andamento.\n' +
              '🔄 Aguarde 2-3 minutos e tente novamente.\n\n' +
              'Os arquivos já foram enviados com sucesso,\n' +
              'basta clicar em "Mesclar" novamente.'
            )
          }
          throw new Error(`Erro HTTP ${mergeResponse.status}: ${mergeResponse.statusText}`)
        }

        const mergeResult = await mergeResponse.json()

        if (mergeResult.success) {
          alert(`✅ ${files.length} volumes mesclados com sucesso!\n\n` +
                `Documento: ${mergeResult.mergedDocument.name}\n` +
                `Total de páginas: ${mergeResult.mergedDocument.totalPages}\n\n` +
                `O documento já está disponível no Knowledge Base.`)

          setFiles([])
          onUploadComplete?.()
        } else {
          setError(mergeResult.error || 'Erro ao mesclar volumes')
        }

      } else {
        // ✅ UPLOAD NORMAL (arquivos pequenos <80MB total)
        console.log(`[VolumeUploader] Upload normal (${(totalSize / 1024 / 1024).toFixed(1)} MB)`)

        const formData = new FormData()
        files.forEach(({ file }) => {
          formData.append('files', file)
        })

        const processName = files[0].file.name.replace(/[_-]?vol.*$/i, '').replace(/\.[^.]+$/, '')
        formData.append('processName', processName)

        const response = await fetch('/api/kb/merge-volumes', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        const result = await response.json()

        if (result.success) {
          alert(`✅ ${files.length} volumes mesclados com sucesso!\n\n` +
                `Documento: ${result.mergedDocument.name}\n` +
                `Total de páginas: ${result.mergedDocument.totalPages}\n\n` +
                `O documento já está disponível no Knowledge Base.`)

          setFiles([])
          onUploadComplete?.()
        } else {
          setError(result.error || 'Erro ao mesclar volumes')
        }
      }

    } catch (err) {
      console.error('[VolumeUploader] Erro:', err)
      setError(err instanceof Error ? err.message : 'Erro ao mesclar volumes')
    } finally {
      setMerging(false)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const detectsVolumes = files.length > 1 && files.every(f => f.volumeNumber > 0)

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center hover:border-stone-400 transition-colors">
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFilesSelected}
          className="hidden"
          id="volume-upload"
          disabled={merging}
        />

        <label htmlFor="volume-upload" className="cursor-pointer block">
          <FileUp className="w-12 h-12 mx-auto text-stone-400 mb-2" />
          <p className="text-stone-600 font-medium">
            Selecione múltiplos PDFs para mesclar
          </p>
          <p className="text-stone-400 text-sm mt-1">
            Arraste arquivos aqui ou clique para selecionar
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <>
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-stone-800">
                Arquivos Selecionados ({files.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                disabled={merging}
              >
                Limpar
              </Button>
            </div>

            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm bg-white p-2 rounded border border-stone-200">
                  <span className="font-mono text-stone-500 w-12">
                    {f.volumeNumber > 0 ? `Vol ${f.volumeNumber}` : `#${i + 1}`}
                  </span>
                  <span className="text-stone-800 flex-1 truncate">{f.file.name}</span>
                  <span className="text-stone-400 text-xs">
                    {(f.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(i)}
                    disabled={merging}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {detectsVolumes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  🔍 Detectados <strong>{files.length} volumes</strong> em sequência automática
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleMergeAndUpload}
              disabled={merging || files.length < 2}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Layers className="w-4 h-4 mr-2" />
              {merging
                ? 'Mesclando...'
                : `Mesclar ${files.length} Volume${files.length > 1 ? 's' : ''} e Adicionar ao KB`}
            </Button>
          </div>

          <p className="text-xs text-stone-500 text-center">
            Os arquivos serão mesclados automaticamente em um único PDF antes do upload
          </p>
        </>
      )}
    </div>
  )
}
