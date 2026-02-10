/**
 * Sistema de Upload Chunked para arquivos grandes
 * Permite upload de arquivos de qualquer tamanho
 * Divide em chunks de 40MB e faz upload incremental
 * ✅ Usa disco persistente /var/data no Render
 */

import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import crypto from 'crypto';
import { ACTIVE_PATHS } from './storage-config.js';

const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB por chunk (otimizado para Render)
const UPLOAD_DIR = path.join(ACTIVE_PATHS.upload, 'chunks'); // /var/data/upload/chunks
const TEMP_DIR = path.join(ACTIVE_PATHS.upload, 'temp');     // /var/data/upload/temp

const SESSIONS_DIR = path.join(ACTIVE_PATHS.upload, 'sessions'); // /var/data/upload/sessions

class ChunkedUpload {
  constructor() {
    // SESSIONS PERSISTENTES: Armazenadas em disco para sobreviver a restarts
    // Cada sessão é um arquivo JSON: /var/data/upload/sessions/{uploadId}.json
  }

  async initialize() {
    // Criar diretórios se não existirem
    console.log('📂 [ChunkedUpload] Criando diretórios:', {
      chunks: UPLOAD_DIR,
      temp: TEMP_DIR,
      sessions: SESSIONS_DIR
    });

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(SESSIONS_DIR, { recursive: true });

    console.log('✅ [ChunkedUpload] Diretórios criados com sucesso');
    console.log(`   Chunk size: ${(CHUNK_SIZE / 1024 / 1024).toFixed(0)} MB`);
    console.log(`   🔄 Sessions persistentes em: ${SESSIONS_DIR}`);
  }

  /**
   * Salva sessão no disco
   */
  async saveSession(uploadId, sessionData) {
    const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
  }

  /**
   * Carrega sessão do disco
   */
  async loadSession(uploadId) {
    const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`);
    try {
      const data = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(data);

      // Converter uploadedChunks array de volta para Set
      if (Array.isArray(session.uploadedChunks)) {
        session.uploadedChunks = new Set(session.uploadedChunks);
      }

      return session;
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove sessão do disco
   */
  async deleteSession(uploadId) {
    const sessionPath = path.join(SESSIONS_DIR, `${uploadId}.json`);
    await fs.unlink(sessionPath).catch(() => {});
  }

  /**
   * Inicia uma nova sessão de upload
   */
  async initSession(filename, fileSize, contentType) {
    const uploadId = crypto.randomBytes(16).toString('hex');

    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    const session = {
      filename,
      fileSize,
      contentType,
      totalChunks,
      uploadedChunks: [], // Salvar como array para JSON
      createdAt: Date.now()
    };

    // Salvar no disco
    await this.saveSession(uploadId, session);

    console.log(`📤 Nova sessão de upload: ${uploadId}`);
    console.log(`   Arquivo: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   Total de chunks: ${totalChunks}`);
    console.log(`   💾 Sessão salva em disco (sobrevive a restarts)`);

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
    // Carregar sessão do disco
    const session = await this.loadSession(uploadId);

    if (!session) {
      throw new Error('Sessão de upload não encontrada - verifique se o /init foi executado');
    }

    if (chunkIndex >= session.totalChunks) {
      throw new Error('Índice de chunk inválido');
    }

    // Salvar chunk no disco
    const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, chunkData);

    // Converter para Set temporariamente
    const uploadedChunks = new Set(session.uploadedChunks || []);

    // Marcar como enviado
    uploadedChunks.add(chunkIndex);

    // Atualizar sessão
    session.uploadedChunks = Array.from(uploadedChunks);
    await this.saveSession(uploadId, session);

    const progress = (uploadedChunks.size / session.totalChunks) * 100;

    console.log(`   Chunk ${chunkIndex + 1}/${session.totalChunks} recebido (${progress.toFixed(1)}%)`);

    return {
      uploadId,
      chunkIndex,
      totalChunks: session.totalChunks,
      uploadedChunks: uploadedChunks.size,
      progress: progress.toFixed(2),
      complete: uploadedChunks.size === session.totalChunks
    };
  }

  /**
   * Finaliza o upload e monta o arquivo completo
   * ✅ Usa streams para evitar carregar tudo na memória
   * ✅ Controle de backpressure automático via pipeline
   * ✅ Limita file descriptors abertos
   */
  async finalizeUpload(uploadId) {
    // Carregar sessão do disco
    const session = await this.loadSession(uploadId);

    if (!session) {
      throw new Error('Sessão de upload não encontrada');
    }

    const uploadedChunks = new Set(session.uploadedChunks || []);

    // Verificar se todos os chunks foram enviados
    if (uploadedChunks.size !== session.totalChunks) {
      throw new Error(`Upload incompleto: ${uploadedChunks.size}/${session.totalChunks} chunks`);
    }

    console.log(`✅ Montando arquivo completo: ${session.filename}`);
    console.log(`   Total chunks: ${session.totalChunks} (~${(session.fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Caminho do arquivo final
    const finalPath = path.join(TEMP_DIR, `${uploadId}_${session.filename}`);
    const writeStream = createWriteStream(finalPath);

    try {
      // Montar arquivo na ordem correta usando streams
      // ✅ Processa 1 chunk por vez para evitar EMFILE error
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);

        // Usar stream para ler chunk (não carrega tudo na memória)
        const readStream = createReadStream(chunkPath);

        // Pipeline com backpressure automático
        await pipeline(readStream, writeStream, { end: false });

        // Limpar chunk após escrita bem-sucedida
        await fs.unlink(chunkPath).catch(() => {});

        // Log de progresso
        if ((i + 1) % 5 === 0 || i === session.totalChunks - 1) {
          console.log(`   Montado ${i + 1}/${session.totalChunks} chunks (${((i + 1) / session.totalChunks * 100).toFixed(1)}%)`);
        }
      }

      // Fechar stream final
      writeStream.end();

      // Aguardar finalização do stream
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verificar tamanho do arquivo final
      const stats = await fs.stat(finalPath);
      const expectedSize = session.fileSize;
      const actualSize = stats.size;

      if (actualSize !== expectedSize) {
        throw new Error(`Tamanho do arquivo não corresponde: esperado ${expectedSize}, obtido ${actualSize}`);
      }

      console.log(`✅ Arquivo montado com sucesso: ${(actualSize / 1024 / 1024).toFixed(2)} MB`);

      // Limpar sessão do disco
      await this.deleteSession(uploadId);

      return {
        success: true,
        uploadId,
        filename: session.filename,
        contentType: session.contentType,
        fileSize: actualSize,
        path: finalPath
      };

    } catch (error) {
      // Fechar stream e limpar em caso de erro
      writeStream.destroy();
      await fs.unlink(finalPath).catch(() => {});

      console.error(`❌ Erro ao montar arquivo:`, error.message);
      throw error;
    }
  }

  /**
   * Cancela um upload e limpa os chunks
   */
  async cancelUpload(uploadId) {
    // Carregar sessão do disco
    const session = await this.loadSession(uploadId);

    if (!session) {
      return { success: false, message: 'Sessão não encontrada' };
    }

    // Limpar todos os chunks
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(UPLOAD_DIR, `${uploadId}_chunk_${i}`);
      await fs.unlink(chunkPath).catch(() => {});
    }

    // Limpar sessão do disco
    await this.deleteSession(uploadId);

    console.log(`❌ Upload cancelado: ${uploadId}`);

    return {
      success: true,
      message: 'Upload cancelado e chunks removidos'
    };
  }

  /**
   * Obtém status de um upload
   */
  async getStatus(uploadId) {
    // Carregar sessão do disco
    const session = await this.loadSession(uploadId);

    if (!session) {
      return null;
    }

    const uploadedChunks = new Set(session.uploadedChunks || []);
    const progress = (uploadedChunks.size / session.totalChunks) * 100;

    return {
      uploadId,
      filename: session.filename,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks: uploadedChunks.size,
      progress: progress.toFixed(2),
      complete: uploadedChunks.size === session.totalChunks,
      createdAt: new Date(session.createdAt).toISOString()
    };
  }

  /**
   * Limpa sessões antigas (> 24h)
   */
  async cleanOldSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    try {
      const files = await fs.readdir(SESSIONS_DIR);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const uploadId = file.replace('.json', '');
        const session = await this.loadSession(uploadId);

        if (session && now - session.createdAt > maxAge) {
          console.log(`🧹 Limpando sessão antiga: ${uploadId}`);
          await this.cancelUpload(uploadId);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar sessões antigas:', error);
    }
  }
}

// Singleton
const chunkedUpload = new ChunkedUpload();

export default chunkedUpload;
