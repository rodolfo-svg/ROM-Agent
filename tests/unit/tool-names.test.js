/**
 * Tool Names Consistency Tests
 *
 * Validates that tool names are consistent across prompts and code:
 * - No references to deprecated 'web_search' (should be 'pesquisar_jurisprudencia')
 * - No references to disabled 'pesquisar_jusbrasil' (tool disabled due to anti-bot)
 * - DataJud documented correctly (requires API token, not "100% oficial" when mocked)
 * - System prompt size optimized (no duplicated tool descriptions)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

describe('Tool Names Consistency', () => {
  let masterRom;
  let allPromptFiles;

  beforeAll(() => {
    // Load master-rom.json
    const masterRomPath = path.join(ROOT_DIR, 'data/rom-project/prompts/gerais/master-rom.json');
    masterRom = JSON.parse(fs.readFileSync(masterRomPath, 'utf8'));

    // Load all prompt JSON files
    const promptsDir = path.join(ROOT_DIR, 'data/rom-project/prompts');
    allPromptFiles = [];

    function findJsonFiles(dir) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findJsonFiles(fullPath);
        } else if (file.endsWith('.json')) {
          allPromptFiles.push({
            path: fullPath,
            name: file,
            content: fs.readFileSync(fullPath, 'utf8')
          });
        }
      }
    }

    findJsonFiles(promptsDir);
  });

  describe('master-rom.json', () => {
    it('should NOT contain "web_search" reference', () => {
      const content = JSON.stringify(masterRom);
      expect(content).not.toContain('web_search');
    });

    it('should NOT contain "pesquisar_jusbrasil" reference', () => {
      const content = JSON.stringify(masterRom);
      expect(content).not.toContain('pesquisar_jusbrasil');
    });

    it('should contain "pesquisar_jurisprudencia" reference', () => {
      const content = JSON.stringify(masterRom);
      expect(content).toContain('pesquisar_jurisprudencia');
    });

    it('should have regra_critica using pesquisar_jurisprudencia', () => {
      expect(masterRom.precedentes?.regra_critica).toContain('pesquisar_jurisprudencia');
      expect(masterRom.precedentes?.regra_critica).not.toContain('web_search');
    });

    it('should have checklistQualidade fundamentacao using pesquisar_jurisprudencia', () => {
      const fundamentacao = masterRom.checklistQualidade?.fundamentacao;
      expect(fundamentacao).toBeDefined();
      const content = JSON.stringify(fundamentacao);
      expect(content).toContain('pesquisar_jurisprudencia');
      expect(content).not.toContain('web_search');
    });
  });

  describe('All Prompt Files', () => {
    it('should have loaded prompt files', () => {
      expect(allPromptFiles.length).toBeGreaterThan(0);
    });

    it('should NOT contain "web_search" in any prompt file', () => {
      const filesWithWebSearch = allPromptFiles.filter(f =>
        f.content.includes('web_search')
      );

      expect(filesWithWebSearch).toEqual([]);
    });

    it('should NOT contain "pesquisar_jusbrasil" in any prompt file', () => {
      const filesWithJusBrasil = allPromptFiles.filter(f =>
        f.content.includes('pesquisar_jusbrasil')
      );

      expect(filesWithJusBrasil).toEqual([]);
    });
  });

  describe('DataJud Documentation', () => {
    it('should document DataJud as requiring API token', () => {
      const bedrockToolsPath = path.join(ROOT_DIR, 'src/modules/bedrock-tools.js');
      const bedrockTools = fs.readFileSync(bedrockToolsPath, 'utf8');

      // Check that DataJud is documented as requiring token
      expect(bedrockTools).toContain('DATAJUD_API_TOKEN');
    });

    it('should NOT claim DataJud is "100% oficial" in tool description', () => {
      const bedrockToolsPath = path.join(ROOT_DIR, 'src/modules/bedrock-tools.js');
      const bedrockTools = fs.readFileSync(bedrockToolsPath, 'utf8');

      // The toolSpec description should not claim 100% official when it requires config
      const toolSpecMatch = bedrockTools.match(/name: 'consultar_cnj_datajud'[\s\S]*?description: '([^']+)'/);
      if (toolSpecMatch) {
        expect(toolSpecMatch[1]).not.toContain('100%');
        expect(toolSpecMatch[1]).not.toContain('Fonte 100%');
      }
    });
  });

  describe('JusBrasil Tool Status', () => {
    it('should have pesquisar_jusbrasil DISABLED in bedrock-tools.js', () => {
      const bedrockToolsPath = path.join(ROOT_DIR, 'src/modules/bedrock-tools.js');
      const bedrockTools = fs.readFileSync(bedrockToolsPath, 'utf8');

      // Check that pesquisar_jusbrasil is commented out
      expect(bedrockTools).toMatch(/\/\/.*pesquisar_jusbrasil/);
    });

    it('should have pesquisar_jusbrasil REMOVED from system prompt', () => {
      const serverEnhancedPath = path.join(ROOT_DIR, 'src/server-enhanced.js');
      const serverEnhanced = fs.readFileSync(serverEnhancedPath, 'utf8');

      // Check that pesquisar_jusbrasil is not in the prompt output
      const promptSection = serverEnhanced.match(/FERRAMENTAS DISPONÍVEIS[\s\S]*?IMPORTANTE/);
      if (promptSection) {
        expect(promptSection[0]).not.toMatch(/prompt \+= .*pesquisar_jusbrasil/);
      }
    });
  });

  describe('System Prompt Size', () => {
    it('should not have duplicated tool descriptions', () => {
      const serverEnhancedPath = path.join(ROOT_DIR, 'src/server-enhanced.js');
      const serverEnhanced = fs.readFileSync(serverEnhancedPath, 'utf8');

      // Count occurrences of full tool description in buildSystemPrompt
      const buildSystemPromptMatch = serverEnhanced.match(/function buildSystemPrompt[\s\S]*?^}/m);
      if (buildSystemPromptMatch) {
        const func = buildSystemPromptMatch[0];

        // Each tool should only be described once in the system prompt
        const pesquisarJurisCount = (func.match(/pesquisar_jurisprudencia/g) || []).length;
        const consultarDatajudCount = (func.match(/consultar_cnj_datajud/g) || []).length;
        const pesquisarSumulasCount = (func.match(/pesquisar_sumulas/g) || []).length;

        // Should have reasonable number of references (not duplicated descriptions)
        expect(pesquisarJurisCount).toBeLessThan(5);
        expect(consultarDatajudCount).toBeLessThan(3);
        expect(pesquisarSumulasCount).toBeLessThan(3);
      }
    });
  });

  describe('Timeout Expectations', () => {
    it('should have realistic timeout in system prompt (not < 1 second)', () => {
      const serverEnhancedPath = path.join(ROOT_DIR, 'src/server-enhanced.js');
      const serverEnhanced = fs.readFileSync(serverEnhancedPath, 'utf8');

      // Should not claim < 1 second for search results presentation
      expect(serverEnhanced).not.toMatch(/APRESENTE.*\(< 1 segundo\)/);
      expect(serverEnhanced).not.toMatch(/ESCREVA < 1s após receber/);
    });
  });
});
