/**
 * Sistema de Upload Chunked para arquivos grandes
 * Permite upload de arquivos de qualquer tamanho
 * Divide em chunks de 40MB e faz upload incremental
 * ✅ Usa disco persistente /var/data no Render
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ACTIVE_PATHS } from './storage-config.js';

const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB por chunk (otimizado para Render)
const UPLOAD_DIR = path.join(ACTIVE_PATHS.upload, 'chunks'); // /var/data/upload/chunks
const TEMP_DIR = path.join(ACTIVE_PATHS.upload, 'temp');     // /var/data/upload/temp

class ChunkedUpload {
  constructor() {
    this.sessions = new Map(); // uploadId -> { chunks, total, filename, contentType }
  }

  async initialize() {
    // Criar diretórios se não existirem
    console.log('📂 [ChunkedUpload] Criando diretórios:', {
      chunks: UPLOAD_DIR,
      temp: TEMP_DIR
    });

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });

    console.log('✅ [ChunkedUpload] Diretórios criados com sucesso');
    console.log(`   Chunk size: ${(CHUNK_SIZE / 1024 / 1024).toFixed(0)} MB`);
  }

  /**
   * Inicia uma nova sessão de upload
   */
  async initSession(filename, fileSize, contentType) {
    const uploadId = crypto.randomBytes(16).toString('hex');

    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    this.sessions.set(uploadId, {
      filename,
      fileSize,
      contentType,
      totalChunks,
      uploadedChunks: new Set(),
      createdAt: Date.now()
    });

    console.log(`📤 Nova sessão de upload: ${uploadId}`);
    console.log(`   Arquivo: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   Total de chunks: ${totalChunks}`);

    return {
      uploadId,
      totalChunks,
      chunkSize: CHUNK_SIZE
    };
  }

  /**
   * Recebe e salva um chunk
   */
  async uploadChunk(uploadId, chunkIndex, chunkData) {
    const session = this.sessions.get(uploadId);

    if (!session) {
      throw new Error('Sessão de upload não encontrada');
    }

    if (chunkIndex >= session.totalChunks) {
      throw new Error('Índice de chunk inválido');
    }

    // Salvar chunk no disco
    const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, chunkData);

    // Marcar como enviado
    session.uploadedChunks.add(chunkIndex);

    const progress = (session.uploadedChunks.size / session.totalChunks) * 100;

    console.log(`   Chunk ${chunkIndex + 1}/${session.totalChunks} recebido (${progress.toFixed(1)}%)`);

    return {
      uploadId,
      chunkIndex,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks.size,
      progress: progress.toFixed(2),
      complete: session.uploadedChunks.size === session.totalChunks
    };
  }

  /**
   * Finaliza o upload e monta o arquivo completo
   */
  async finalizeUpload(uploadId) {
    const session = this.sessions.get(uploadId);

    if (!session) {
      throw new Error('Sessão de upload não encontrada');
    }

    // Verificar se todos os chunks foram enviados
    if (session.uploadedChunks.size !== session.totalChunks) {
      throw new Error(`Upload incompleto: ${session.uploadedChunks.size}/${session.totalChunks} chunks`);
    }

    console.log(`✅ Montando arquivo completo: ${session.filename}`);

    // Caminho do arquivo final
    const finalPath = path.join(TEMP_DIR, `${uploadId}_${session.filename}`);
    const writeStream = await fs.open(finalPath, 'w');

    try {
      // Montar arquivo na ordem correta
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);
        const chunkData = await fs.readFile(chunkPath);
        await writeStream.write(chunkData);

        // Limpar chunk após escrita
        await fs.unlink(chunkPath).catch(() => {});
      }

      await writeStream.close();

      // Verificar tamanho do arquivo final
      const stats = await fs.stat(finalPath);
      const expectedSize = session.fileSize;
      const actualSize = stats.size;

      if (actualSize !== expectedSize) {
        throw new Error(`Tamanho do arquivo não corresponde: esperado ${expectedSize}, obtido ${actualSize}`);
      }

      console.log(`✅ Arquivo montado com sucesso: ${(actualSize / 1024 / 1024).toFixed(2)} MB`);

      // Limpar sessão
      this.sessions.delete(uploadId);

      return {
        success: true,
        uploadId,
        filename: session.filename,
        contentType: session.contentType,
        fileSize: actualSize,
        path: finalPath
      };

    } catch (error) {
      await writeStream.close().catch(() => {});
      // Limpar arquivo parcial em caso de erro
      await fs.unlink(finalPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Cancela um upload e limpa os chunks
   */
  async cancelUpload(uploadId) {
    const session = this.sessions.get(uploadId);

    if (!session) {
      return { success: false, message: 'Sessão não encontrada' };
    }

    // Limpar todos os chunks
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);
      await fs.unlink(chunkPath).catch(() => {});
    }

    this.sessions.delete(uploadId);

    console.log(`❌ Upload cancelado: ${uploadId}`);

    return {
      success: true,
      message: 'Upload cancelado e chunks removidos'
    };
  }

  /**
   * Obtém status de um upload
   */
  getStatus(uploadId) {
    const session = this.sessions.get(uploadId);

    if (!session) {
      return null;
    }

    const progress = (session.uploadedChunks.size / session.totalChunks) * 100;

    return {
      uploadId,
      filename: session.filename,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks.size,
      progress: progress.toFixed(2),
      complete: session.uploadedChunks.size === session.totalChunks,
      createdAt: new Date(session.createdAt).toISOString()
    };
  }

  /**
   * Limpa sessões antigas (> 24h)
   */
  async cleanOldSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [uploadId, session] of this.sessions.entries()) {
      if (now - session.createdAt > maxAge) {
        console.log(`🧹 Limpando sessão antiga: ${uploadId}`);
        await this.cancelUpload(uploadId);
      }
    }
  }
}

// Singleton
const chunkedUpload = new ChunkedUpload();

export default chunkedUpload;
