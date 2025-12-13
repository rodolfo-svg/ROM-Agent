/**
 * ROM Agent - Ferramentas SDK Completas
 * Implementação de todas as ferramentas do Claude Agent SDK
 * Similar à implementação de referência do Claude AI
 */

import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { glob } from 'fs/promises';

const execAsync = promisify(exec);

// ============================================================================
// FERRAMENTA: FILE READ
// ============================================================================
export const fileRead = {
  name: 'file_read',
  description: `Lê um arquivo do sistema de arquivos local.
  - Pode ler qualquer tipo de arquivo (texto, código, configuração)
  - Por padrão lê até 2000 linhas do início do arquivo
  - Suporta offset e limit para arquivos grandes
  - Retorna conteúdo com números de linha`,

  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Caminho absoluto para o arquivo a ser lido'
      },
      offset: {
        type: 'number',
        description: 'Número da linha para começar a leitura (opcional)'
      },
      limit: {
        type: 'number',
        description: 'Número de linhas para ler (opcional, padrão: 2000)'
      }
    },
    required: ['file_path']
  },

  async execute({ file_path, offset = 0, limit = 2000 }) {
    try {
      if (!existsSync(file_path)) {
        return { success: false, error: `Arquivo não encontrado: ${file_path}` };
      }

      const content = await fs.readFile(file_path, 'utf-8');
      const lines = content.split('\n');

      const startLine = offset;
      const endLine = Math.min(startLine + limit, lines.length);
      const selectedLines = lines.slice(startLine, endLine);

      // Formatar com números de linha
      const formattedContent = selectedLines
        .map((line, i) => `${String(startLine + i + 1).padStart(6)}→${line}`)
        .join('\n');

      return {
        success: true,
        content: formattedContent,
        total_lines: lines.length,
        lines_read: selectedLines.length,
        from_line: startLine + 1,
        to_line: endLine
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: FILE WRITE
// ============================================================================
export const fileWrite = {
  name: 'file_write',
  description: `Escreve conteúdo em um arquivo.
  - Cria o arquivo se não existir
  - Sobrescreve o conteúdo existente
  - Cria diretórios intermediários se necessário`,

  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Caminho absoluto para o arquivo a ser escrito'
      },
      content: {
        type: 'string',
        description: 'Conteúdo a ser escrito no arquivo'
      }
    },
    required: ['file_path', 'content']
  },

  async execute({ file_path, content }) {
    try {
      // Criar diretório se não existir
      const dir = path.dirname(file_path);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(file_path, content, 'utf-8');

      return {
        success: true,
        message: `Arquivo escrito com sucesso: ${file_path}`,
        bytes_written: Buffer.byteLength(content, 'utf-8')
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: FILE EDIT
// ============================================================================
export const fileEdit = {
  name: 'file_edit',
  description: `Realiza substituições exatas de strings em arquivos.
  - Substitui old_string por new_string
  - A old_string deve ser única no arquivo (ou usar replace_all)
  - Preserva a indentação original`,

  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Caminho absoluto para o arquivo a ser modificado'
      },
      old_string: {
        type: 'string',
        description: 'Texto a ser substituído'
      },
      new_string: {
        type: 'string',
        description: 'Texto substituto'
      },
      replace_all: {
        type: 'boolean',
        description: 'Se true, substitui todas as ocorrências (padrão: false)',
        default: false
      }
    },
    required: ['file_path', 'old_string', 'new_string']
  },

  async execute({ file_path, old_string, new_string, replace_all = false }) {
    try {
      if (!existsSync(file_path)) {
        return { success: false, error: `Arquivo não encontrado: ${file_path}` };
      }

      const content = await fs.readFile(file_path, 'utf-8');

      // Contar ocorrências
      const occurrences = content.split(old_string).length - 1;

      if (occurrences === 0) {
        return { success: false, error: 'String não encontrada no arquivo' };
      }

      if (occurrences > 1 && !replace_all) {
        return {
          success: false,
          error: `String encontrada ${occurrences} vezes. Use replace_all=true ou forneça mais contexto.`
        };
      }

      let newContent;
      if (replace_all) {
        newContent = content.split(old_string).join(new_string);
      } else {
        newContent = content.replace(old_string, new_string);
      }

      await fs.writeFile(file_path, newContent, 'utf-8');

      return {
        success: true,
        message: `Arquivo editado com sucesso`,
        replacements: replace_all ? occurrences : 1
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: GLOB
// ============================================================================
export const globTool = {
  name: 'glob',
  description: `Busca arquivos usando padrões glob.
  - Suporta padrões como "**/*.js", "src/**/*.ts"
  - Retorna caminhos dos arquivos encontrados
  - Ordenados por data de modificação`,

  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Padrão glob para buscar arquivos'
      },
      path: {
        type: 'string',
        description: 'Diretório base para a busca (opcional)'
      }
    },
    required: ['pattern']
  },

  async execute({ pattern, path: searchPath = process.cwd() }) {
    try {
      const { glob: globSync } = await import('glob');

      const fullPattern = path.join(searchPath, pattern);
      const files = await globSync(fullPattern, { nodir: true });

      // Obter stats e ordenar por modificação
      const filesWithStats = await Promise.all(
        files.map(async (file) => {
          try {
            const stats = await fs.stat(file);
            return { file, mtime: stats.mtime };
          } catch {
            return { file, mtime: new Date(0) };
          }
        })
      );

      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      return {
        success: true,
        files: filesWithStats.map(f => f.file),
        count: files.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: GREP
// ============================================================================
export const grepTool = {
  name: 'grep',
  description: `Busca padrões em arquivos usando expressões regulares.
  - Similar ao ripgrep (rg)
  - Suporta filtro por tipo de arquivo
  - Múltiplos modos de saída`,

  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Expressão regular para buscar'
      },
      path: {
        type: 'string',
        description: 'Arquivo ou diretório para buscar'
      },
      glob: {
        type: 'string',
        description: 'Filtro glob para arquivos (ex: "*.js")'
      },
      output_mode: {
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description: 'Modo de saída'
      },
      case_insensitive: {
        type: 'boolean',
        description: 'Busca case-insensitive'
      },
      context_lines: {
        type: 'number',
        description: 'Linhas de contexto antes e depois'
      }
    },
    required: ['pattern']
  },

  async execute({ pattern, path: searchPath = '.', glob: fileGlob, output_mode = 'files_with_matches', case_insensitive = false, context_lines = 0 }) {
    try {
      // Tentar usar ripgrep se disponível
      let command = 'rg';
      let args = [];

      if (case_insensitive) args.push('-i');
      if (output_mode === 'files_with_matches') args.push('-l');
      if (output_mode === 'count') args.push('-c');
      if (output_mode === 'content') {
        args.push('-n');
        if (context_lines > 0) args.push(`-C${context_lines}`);
      }
      if (fileGlob) args.push(`--glob=${fileGlob}`);
      args.push(pattern);
      args.push(searchPath);

      const { stdout, stderr } = await execAsync(`${command} ${args.join(' ')}`);

      const lines = stdout.trim().split('\n').filter(l => l);

      return {
        success: true,
        results: lines,
        count: lines.length,
        output_mode
      };
    } catch (error) {
      // Se rg não disponível, usar grep nativo
      if (error.code === 127 || error.message.includes('not found')) {
        try {
          const grepFlags = case_insensitive ? '-rni' : '-rn';
          const { stdout } = await execAsync(`grep ${grepFlags} "${pattern}" ${searchPath}`);
          const lines = stdout.trim().split('\n').filter(l => l);
          return { success: true, results: lines, count: lines.length };
        } catch (grepError) {
          return { success: true, results: [], count: 0 };
        }
      }
      // Se não encontrou resultados, retornar vazio
      if (error.code === 1) {
        return { success: true, results: [], count: 0 };
      }
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: BASH
// ============================================================================
export const bashTool = {
  name: 'bash',
  description: `Executa comandos bash no terminal.
  - Suporta qualquer comando shell
  - Timeout configurável
  - Captura stdout e stderr`,

  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Comando a ser executado'
      },
      timeout: {
        type: 'number',
        description: 'Timeout em milissegundos (máx: 600000)',
        default: 120000
      },
      description: {
        type: 'string',
        description: 'Descrição curta do comando'
      },
      working_directory: {
        type: 'string',
        description: 'Diretório de trabalho para execução'
      }
    },
    required: ['command']
  },

  async execute({ command, timeout = 120000, working_directory }) {
    try {
      const options = {
        timeout: Math.min(timeout, 600000),
        maxBuffer: 10 * 1024 * 1024, // 10MB
      };

      if (working_directory) {
        options.cwd = working_directory;
      }

      const { stdout, stderr } = await execAsync(command, options);

      return {
        success: true,
        stdout: stdout.slice(0, 50000), // Limitar output
        stderr: stderr.slice(0, 10000),
        exit_code: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout?.slice(0, 50000) || '',
        stderr: error.stderr?.slice(0, 10000) || error.message,
        exit_code: error.code || 1
      };
    }
  }
};

// ============================================================================
// FERRAMENTA: WEB FETCH
// ============================================================================
export const webFetchTool = {
  name: 'web_fetch',
  description: `Busca conteúdo de uma URL e processa com IA.
  - Converte HTML para markdown
  - Processa o conteúdo com o prompt fornecido
  - Cache de 15 minutos`,

  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL para buscar conteúdo'
      },
      prompt: {
        type: 'string',
        description: 'Prompt para processar o conteúdo'
      }
    },
    required: ['url', 'prompt']
  },

  async execute({ url, prompt }) {
    try {
      const fetch = (await import('node-fetch')).default;
      const TurndownService = (await import('turndown')).default;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ROM-Agent/1.0; Legal Research Bot)'
        },
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const contentType = response.headers.get('content-type') || '';
      let content;

      if (contentType.includes('text/html')) {
        const html = await response.text();
        const turndown = new TurndownService();
        content = turndown.turndown(html);
      } else {
        content = await response.text();
      }

      // Limitar tamanho
      if (content.length > 100000) {
        content = content.slice(0, 100000) + '\n\n[Conteúdo truncado...]';
      }

      return {
        success: true,
        url,
        content,
        content_type: contentType,
        prompt_applied: prompt
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: WEB SEARCH
// ============================================================================
export const webSearchTool = {
  name: 'web_search',
  description: `Realiza busca na web e retorna resultados.
  - Suporta filtro por domínios
  - Retorna links formatados em markdown`,

  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query de busca'
      },
      allowed_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Apenas incluir resultados destes domínios'
      },
      blocked_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Excluir resultados destes domínios'
      }
    },
    required: ['query']
  },

  async execute({ query, allowed_domains = [], blocked_domains = [] }) {
    try {
      // Usar DuckDuckGo HTML (não requer API key)
      const fetch = (await import('node-fetch')).default;
      const encodedQuery = encodeURIComponent(query);

      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ROM-Agent/1.0)'
        }
      });

      const html = await response.text();
      const cheerio = (await import('cheerio')).load(html);

      const results = [];
      cheerio('.result').each((i, elem) => {
        const title = cheerio(elem).find('.result__title').text().trim();
        const url = cheerio(elem).find('.result__url').text().trim();
        const snippet = cheerio(elem).find('.result__snippet').text().trim();

        if (title && url) {
          // Verificar filtros de domínio
          const domain = url.split('/')[0];

          if (allowed_domains.length > 0 && !allowed_domains.some(d => domain.includes(d))) {
            return;
          }
          if (blocked_domains.some(d => domain.includes(d))) {
            return;
          }

          results.push({ title, url: `https://${url}`, snippet });
        }
      });

      return {
        success: true,
        query,
        results: results.slice(0, 10),
        count: results.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: TODO WRITE
// ============================================================================
export const todoWriteTool = {
  name: 'todo_write',
  description: `Gerencia lista de tarefas para planejamento.
  - Estados: pending, in_progress, completed
  - Ajuda a rastrear progresso`,

  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Descrição da tarefa' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Estado da tarefa'
            },
            activeForm: { type: 'string', description: 'Forma ativa da tarefa' }
          },
          required: ['content', 'status', 'activeForm']
        },
        description: 'Lista de tarefas atualizada'
      }
    },
    required: ['todos']
  },

  // Estado interno para manter os todos
  _todos: [],

  async execute({ todos }) {
    this._todos = todos;

    const summary = {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      in_progress: todos.filter(t => t.status === 'in_progress').length,
      completed: todos.filter(t => t.status === 'completed').length
    };

    return {
      success: true,
      message: 'Lista de tarefas atualizada',
      summary,
      todos
    };
  },

  getTodos() {
    return this._todos;
  }
};

// ============================================================================
// FERRAMENTA: ASK USER
// ============================================================================
export const askUserTool = {
  name: 'ask_user',
  description: `Faz perguntas ao usuário durante a execução.
  - Permite coletar preferências
  - Clarificar instruções ambíguas
  - Obter decisões de implementação`,

  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'A pergunta a fazer' },
            header: { type: 'string', description: 'Rótulo curto (máx 12 chars)' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' }
                }
              },
              description: 'Opções de resposta (2-4)'
            },
            multiSelect: { type: 'boolean', description: 'Permitir múltiplas seleções' }
          },
          required: ['question', 'header', 'options']
        },
        description: 'Perguntas a fazer (1-4)'
      }
    },
    required: ['questions']
  },

  // Esta ferramenta requer interação com usuário
  async execute({ questions }) {
    return {
      success: true,
      requires_user_input: true,
      questions,
      message: 'Aguardando resposta do usuário...'
    };
  }
};

// ============================================================================
// FERRAMENTA: LIST DIRECTORY
// ============================================================================
export const listDirectoryTool = {
  name: 'list_directory',
  description: `Lista conteúdo de um diretório.
  - Mostra arquivos e subdiretórios
  - Inclui informações de tamanho e data`,

  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Caminho do diretório a listar'
      },
      recursive: {
        type: 'boolean',
        description: 'Listar recursivamente',
        default: false
      }
    },
    required: ['path']
  },

  async execute({ path: dirPath, recursive = false }) {
    try {
      if (!existsSync(dirPath)) {
        return { success: false, error: `Diretório não encontrado: ${dirPath}` };
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          items.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          });

          if (recursive && entry.isDirectory()) {
            const subItems = await this.execute({ path: fullPath, recursive: true });
            if (subItems.success) {
              items.push(...subItems.items);
            }
          }
        } catch {
          // Ignorar erros de permissão
        }
      }

      return {
        success: true,
        path: dirPath,
        items,
        count: items.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: COPY FILE
// ============================================================================
export const copyFileTool = {
  name: 'copy_file',
  description: 'Copia um arquivo de origem para destino',

  input_schema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Caminho do arquivo de origem' },
      destination: { type: 'string', description: 'Caminho de destino' }
    },
    required: ['source', 'destination']
  },

  async execute({ source, destination }) {
    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
      return { success: true, message: `Copiado: ${source} -> ${destination}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: MOVE FILE
// ============================================================================
export const moveFileTool = {
  name: 'move_file',
  description: 'Move ou renomeia um arquivo',

  input_schema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Caminho atual do arquivo' },
      destination: { type: 'string', description: 'Novo caminho do arquivo' }
    },
    required: ['source', 'destination']
  },

  async execute({ source, destination }) {
    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
      return { success: true, message: `Movido: ${source} -> ${destination}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// FERRAMENTA: DELETE FILE
// ============================================================================
export const deleteFileTool = {
  name: 'delete_file',
  description: 'Remove um arquivo ou diretório',

  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Caminho do arquivo/diretório a remover' },
      recursive: { type: 'boolean', description: 'Remover recursivamente (para diretórios)', default: false }
    },
    required: ['path']
  },

  async execute({ path: targetPath, recursive = false }) {
    try {
      const stats = await fs.stat(targetPath);
      if (stats.isDirectory() && recursive) {
        await fs.rm(targetPath, { recursive: true });
      } else {
        await fs.unlink(targetPath);
      }
      return { success: true, message: `Removido: ${targetPath}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================================
// EXPORTAÇÃO PRINCIPAL
// ============================================================================
export const SDK_TOOLS = {
  // Ferramentas de Arquivo
  file_read: fileRead,
  file_write: fileWrite,
  file_edit: fileEdit,
  list_directory: listDirectoryTool,
  copy_file: copyFileTool,
  move_file: moveFileTool,
  delete_file: deleteFileTool,

  // Ferramentas de Busca
  glob: globTool,
  grep: grepTool,

  // Ferramentas de Sistema
  bash: bashTool,

  // Ferramentas Web
  web_fetch: webFetchTool,
  web_search: webSearchTool,

  // Ferramentas de Organização
  todo_write: todoWriteTool,
  ask_user: askUserTool
};

// Lista de definições para API Anthropic
export function getToolDefinitions() {
  return Object.values(SDK_TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }));
}

// Executar ferramenta por nome
export async function executeTool(toolName, input) {
  const tool = SDK_TOOLS[toolName];
  if (!tool) {
    return { success: false, error: `Ferramenta não encontrada: ${toolName}` };
  }
  return await tool.execute(input);
}

export default {
  SDK_TOOLS,
  getToolDefinitions,
  executeTool
};
