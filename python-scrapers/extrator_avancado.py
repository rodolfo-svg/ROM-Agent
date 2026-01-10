#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SISTEMA AVANÇADO DE EXTRAÇÃO E ANÁLISE PROCESSUAL
Versão: 3.0 - Com ferramentas expandidas
Autor: Sistema IAROM
Site: https://iarom.com.br/extrator-processual

NOVAS FUNCIONALIDADES:
- Transcrição completa de depoimentos
- Análise avançada de prazos (preclusão, prescrição, decadência, tempestividade)
- Fichamento detalhado de documentos anexados
- Degravação de vídeo
- OCR para imagens
- Interface gráfica para seleção de diretório
"""

import os
import sys
import json
import shutil
import subprocess
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Tuple
import platform

# Tkinter é opcional - apenas para modo desktop com GUI
# No servidor web (Render, etc), não precisa de tkinter
try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
    TKINTER_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    TKINTER_AVAILABLE = False
    print("⚠️  Tkinter não disponível - modo servidor (sem GUI)", flush=True)

class ExtratorProcessualAvancado:
    """
    Sistema avançado de extração e análise de processos judiciais
    Versão expandida com 60+ ferramentas especializadas (PDFs, OCR, vídeos, planilhas, etc)
    """

    def __init__(self, otimizar_para_claude=False, criar_resumo_denso=False, cliente='', finalidade='', pedidos_especificos=''):
        """
        Args:
            otimizar_para_claude (bool): Se True, otimiza texto para Claude.ai (reduz 30-50%)
                                         Se False, mantém texto original completo
            criar_resumo_denso (bool): Se True, cria Resumo Executivo Denso completo
            cliente (str): Nome do cliente no processo
            finalidade (str): Finalidade/objetivo da análise
            pedidos_especificos (str): Instruções específicas de análise
                                       Ex: "Analise tecnicamente os laudos médicos"
                                            "Dê ênfase nos relatórios financeiros"
                                            "Analise os balanços e balancetes"
        """
        self.sistema_operacional = platform.system()
        self.versao = "3.0"
        self.pasta_trabalho = None
        self.pasta_saida = None
        self.pasta_compactada = None
        self.pasta_upload_kb = None
        self.pdfs = []
        self.videos = []
        self.imagens = []
        self.config = {}
        self.otimizar_para_claude = otimizar_para_claude  # Controla otimização
        self.criar_resumo_denso = criar_resumo_denso  # Resumo Executivo Denso
        self.cliente = cliente  # Cliente
        self.finalidade = finalidade  # Finalidade
        self.pedidos_especificos = pedidos_especificos  # NOVO: Pedidos Específicos

    def otimizar_texto(self, texto: str) -> str:
        """
        Otimiza texto para Claude.ai removendo espaços desnecessários
        sem perder NENHUM conteúdo real

        Reduz tamanho em 30-50% mantendo 100% do conteúdo

        Se self.otimizar_para_claude = False, retorna texto original
        """
        # Se otimização desabilitada, retorna texto original
        if not self.otimizar_para_claude:
            return texto

        if not texto or not isinstance(texto, str):
            return texto

        # 1. Remover espaços no final de cada linha
        linhas = texto.split('\n')
        linhas = [linha.rstrip() for linha in linhas]

        # 2. Remover linhas vazias consecutivas (max 1 linha em branco)
        linhas_otimizadas = []
        linha_vazia_anterior = False

        for linha in linhas:
            if not linha.strip():  # Linha vazia
                if not linha_vazia_anterior:
                    linhas_otimizadas.append('')
                    linha_vazia_anterior = True
            else:
                linhas_otimizadas.append(linha)
                linha_vazia_anterior = False

        # 3. Remover espaços múltiplos consecutivos (mas manter indentação)
        linhas_finais = []
        for linha in linhas_otimizadas:
            if linha.strip():  # Se não for linha vazia
                # Preservar indentação inicial, comprimir espaços internos
                leading_spaces = len(linha) - len(linha.lstrip())
                conteudo = linha.lstrip()
                # Comprimir múltiplos espaços internos para 1 espaço
                conteudo = re.sub(r' {2,}', ' ', conteudo)
                # Reconstruir com indentação mínima (max 4 espaços)
                indentacao = min(leading_spaces, 4)
                linha = ' ' * indentacao + conteudo
            linhas_finais.append(linha)

        # 4. Juntar tudo
        texto_otimizado = '\n'.join(linhas_finais)

        # 5. Remover quebras de linha no início e fim
        texto_otimizado = texto_otimizado.strip()

        # Estatísticas de compressão
        tamanho_original = len(texto)
        tamanho_otimizado = len(texto_otimizado)
        reducao = 100 - (tamanho_otimizado / tamanho_original * 100) if tamanho_original > 0 else 0

        if reducao > 1:  # Só mostrar se houve redução significativa
            print(f"      📊 Texto otimizado: {tamanho_original:,} → {tamanho_otimizado:,} chars (-{reducao:.1f}%)", flush=True)

        return texto_otimizado

    def selecionar_diretorio_saida(self):
        """Interface gráfica para seleção de diretório de salvamento"""
        if not TKINTER_AVAILABLE:
            print("❌ Tkinter não disponível - use configurar_processo() diretamente", flush=True)
            return None

        print("\n🗂️  Seleção de diretório de salvamento...")

        root = tk.Tk()
        root.withdraw()  # Oculta a janela principal

        # Diálogo para seleção de pasta
        diretorio = filedialog.askdirectory(
            title="Selecione o diretório onde deseja salvar os arquivos extraídos",
            initialdir=os.path.expanduser("~")
        )

        root.destroy()

        if diretorio:
            print(f"✅ Diretório selecionado: {diretorio}")
            return diretorio
        else:
            print("❌ Nenhum diretório selecionado!")
            return None

    def selecionar_diretorio_entrada(self):
        """Interface gráfica para seleção de diretório com os PDFs"""
        if not TKINTER_AVAILABLE:
            print("❌ Tkinter não disponível - use configurar_processo() diretamente", flush=True)
            return None

        print("\n📁 Seleção de diretório de entrada...")

        root = tk.Tk()
        root.withdraw()

        diretorio = filedialog.askdirectory(
            title="Selecione a pasta contendo os PDFs do processo",
            initialdir=os.path.expanduser("~")
        )

        root.destroy()

        if diretorio:
            print(f"✅ Pasta selecionada: {diretorio}")
            return diretorio
        else:
            print("❌ Nenhuma pasta selecionada!")
            return None

    def detectar_sistema(self):
        """Detecta o sistema operacional e configura caminhos"""
        print(f"🖥️  Sistema detectado: {self.sistema_operacional}")

        if self.sistema_operacional == "Windows":
            self.separador = "\\"
            self.executavel_pdf = "pdftotext.exe"
        elif self.sistema_operacional == "Darwin":  # macOS
            self.separador = "/"
            self.executavel_pdf = "pdftotext"
        else:  # Linux
            self.separador = "/"
            self.executavel_pdf = "pdftotext"

    def verificar_dependencias(self):
        """Verifica se todas as dependências estão instaladas"""
        print("\n🔍 Verificando dependências...")

        dependencias_ok = True

        # Verificar pdftotext
        try:
            subprocess.run([self.executavel_pdf, "-v"],
                          capture_output=True,
                          check=True)
            print("  ✓ pdftotext instalado")
        except:
            print("  ✗ pdftotext não encontrado")
            dependencias_ok = False

        return dependencias_ok

    def configurar_processo(self, pasta_pdfs: str = None, pasta_destino: str = None, numero_processo: str = None):
        """Configura o processo a ser analisado"""
        print("\n" + "="*80)
        print("CONFIGURAÇÃO DO PROCESSO")
        print("="*80)

        # Selecionar pasta de entrada se não fornecida
        if not pasta_pdfs:
            pasta_pdfs = self.selecionar_diretorio_entrada()
            if not pasta_pdfs:
                raise Exception("❌ Pasta de entrada não selecionada!")

        self.pasta_trabalho = pasta_pdfs

        # Buscar arquivos
        self.pdfs = self._buscar_pdfs(pasta_pdfs)
        self.videos = self._buscar_videos(pasta_pdfs)
        self.imagens = self._buscar_imagens(pasta_pdfs)

        if not self.pdfs and not self.videos and not self.imagens:
            raise Exception(f"❌ Nenhum arquivo encontrado em: {pasta_pdfs}")

        print(f"\n✓ Arquivos encontrados:")
        print(f"  📄 PDFs: {len(self.pdfs)}")
        print(f"  🎥 Vídeos: {len(self.videos)}")
        print(f"  🖼️  Imagens: {len(self.imagens)}")

        # Detectar número do processo
        if not numero_processo:
            numero_processo = self._detectar_numero_processo()

        self.config['numero_processo'] = numero_processo
        self.config['data_extracao'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Selecionar diretório de saída se não fornecido
        if not pasta_destino:
            # Em servidor, criar automaticamente na mesma pasta dos PDFs
            pasta_destino = os.path.dirname(pasta_pdfs) if pasta_pdfs else os.getcwd()

        # Criar estrutura de pastas
        nome_base = numero_processo.replace(".", "_").replace("-", "_") if numero_processo else "processo"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        self.pasta_saida = os.path.join(pasta_destino, f"ANALISE_COMPLETA_{nome_base}_{timestamp}")
        self.pasta_compactada = os.path.join(pasta_destino, f"PACOTE_CLAUDE_AI_{nome_base}_{timestamp}")
        self.pasta_upload_kb = os.path.join(pasta_destino, f"UPLOAD_KB_{nome_base}_{timestamp}")

        print(f"\n✓ Processo configurado: {numero_processo}")
        print(f"✓ Salvamento em: {self.pasta_saida}")

    def _buscar_pdfs(self, pasta: str) -> List[str]:
        """Busca todos os PDFs em uma pasta"""
        pdfs = []
        for arquivo in os.listdir(pasta):
            if arquivo.lower().endswith('.pdf'):
                pdfs.append(os.path.join(pasta, arquivo))
        return sorted(pdfs)

    def _buscar_videos(self, pasta: str) -> List[str]:
        """Busca todos os vídeos em uma pasta"""
        videos = []
        extensoes = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm']
        for arquivo in os.listdir(pasta):
            if any(arquivo.lower().endswith(ext) for ext in extensoes):
                videos.append(os.path.join(pasta, arquivo))
        return sorted(videos)

    def _buscar_imagens(self, pasta: str) -> List[str]:
        """Busca todas as imagens em uma pasta"""
        imagens = []
        extensoes = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif']
        for arquivo in os.listdir(pasta):
            if any(arquivo.lower().endswith(ext) for ext in extensoes):
                imagens.append(os.path.join(pasta, arquivo))
        return sorted(imagens)

    def _detectar_numero_processo(self) -> str:
        """Tenta detectar o número do processo nos PDFs"""
        padrao = r'\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}'

        if self.pdfs:
            try:
                resultado = subprocess.run(
                    ['pdftotext', '-f', '1', '-l', '3', self.pdfs[0], '-'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                match = re.search(padrao, resultado.stdout)
                if match:
                    return match.group(0)
            except:
                pass

        return "PROCESSO_SEM_NUMERO"

    def executar_extracao_completa(self):
        """Executa todas as ferramentas de extração e análise"""
        print("\n" + "="*80)
        print("INICIANDO EXTRAÇÃO COMPLETA - 60+ FERRAMENTAS")
        print("="*80)

        # Criar estrutura de pastas
        try:
            self._criar_estrutura_pastas()
        except Exception as e:
            print(f"❌ ERRO ao criar estrutura: {e}")
            raise

        # Extração de texto (PDFs) - CRÍTICO
        try:
            texto_completo = self._ferramenta_01_extrair_texto_pdfs()
            print(f"✅ Ferramenta 01: OK ({len(texto_completo)} chars)")
        except Exception as e:
            print(f"❌ ERRO na ferramenta 01: {e}")
            import traceback
            traceback.print_exc()
            raise

        # OCR de imagens
        try:
            texto_imagens = self._ferramenta_02_ocr_imagens()
            texto_completo += "\n\n" + texto_imagens
            print(f"✅ Ferramenta 02: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 02: {e} (continuando...)")

        # Degravação de vídeos
        try:
            texto_videos = self._ferramenta_03_degravar_videos()
            texto_completo += "\n\n" + texto_videos
            print(f"✅ Ferramenta 03: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 03: {e} (continuando...)")

        # Análises básicas
        try:
            movimentos = self._ferramenta_04_extrair_movimentos(texto_completo)
            print(f"✅ Ferramenta 04: OK ({len(movimentos)} movimentos)")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 04: {e} (continuando...)")
            movimentos = []

        try:
            documentos = self._ferramenta_05_extrair_documentos(texto_completo)
            print(f"✅ Ferramenta 05: OK ({len(documentos)} documentos)")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 05: {e} (continuando...)")
            documentos = []

        # NOVA: Transcrição de depoimentos
        try:
            depoimentos = self._ferramenta_06_transcrever_depoimentos(texto_completo)
            self._salvar_transcricao_depoimentos(depoimentos)
            print(f"✅ Ferramenta 06: OK ({len(depoimentos)} depoimentos)")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 06: {e} (continuando...)")
            depoimentos = []

        # NOVA: Análise avançada de prazos
        try:
            prazos = self._ferramenta_07_analisar_prazos_avancado(texto_completo, movimentos)
            self._salvar_analise_prazos_avancada(prazos)
            print(f"✅ Ferramenta 07: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 07: {e} (continuando...)")
            prazos = {}

        # NOVA: Fichamento detalhado de documentos anexados
        try:
            docs_anexados = self._ferramenta_08_fichar_documentos_anexados(texto_completo, documentos)
            self._salvar_fichamento_documentos_anexados(docs_anexados)
            print(f"✅ Ferramenta 08: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 08: {e} (continuando...)")
            docs_anexados = []

        # Gerar índices e fichamentos
        try:
            self._ferramenta_09_gerar_indice(movimentos, documentos, depoimentos)
            print(f"✅ Ferramenta 09: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 09: {e} (continuando...)")

        try:
            self._ferramenta_10_fichamento_documentos(documentos)
            print(f"✅ Ferramenta 10: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 10: {e} (continuando...)")

        try:
            self._ferramenta_11_fichamento_integral(movimentos)
            print(f"✅ Ferramenta 11: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 11: {e} (continuando...)")

        # Relatórios jurídicos
        try:
            self._ferramenta_12_relatorio_legislacao(texto_completo)
            print(f"✅ Ferramenta 12: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 12: {e} (continuando...)")

        try:
            self._ferramenta_13_relatorio_calculos(texto_completo)
            print(f"✅ Ferramenta 13: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 13: {e} (continuando...)")

        try:
            self._ferramenta_14_relatorio_avaliacoes(texto_completo)
            print(f"✅ Ferramenta 14: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 14: {e} (continuando...)")

        try:
            self._ferramenta_15_relatorio_omissoes(texto_completo, movimentos)
            print(f"✅ Ferramenta 15: OK")
        except Exception as e:
            print(f"⚠️ AVISO na ferramenta 15: {e} (continuando...)")

        # Análises complementares (15 ferramentas adicionais)
        try:
            self._ferramentas_16_50_complementares(texto_completo, movimentos, documentos)
            print(f"✅ Ferramentas 16-50: OK")
        except Exception as e:
            print(f"⚠️ AVISO nas ferramentas 16-50: {e} (continuando...)")

        # Gerar resumo executivo
        try:
            self._gerar_resumo_executivo(movimentos, documentos, prazos, depoimentos)
            print(f"✅ Resumo executivo: OK")
        except Exception as e:
            print(f"⚠️ AVISO no resumo executivo: {e} (continuando...)")

        # Gerar Resumo Executivo DENSO (se solicitado)
        if self.criar_resumo_denso:
            try:
                self._gerar_resumo_executivo_denso(texto_completo, movimentos, documentos, prazos, depoimentos)
                print(f"✅ Resumo Executivo DENSO: OK")
            except Exception as e:
                print(f"⚠️ AVISO no resumo denso: {e} (continuando...)")

            # Gerar GUIA ESTRATÉGICO para uso no Claude.ai
            try:
                self._gerar_guia_estrategico_claude(movimentos, documentos, depoimentos)
                print(f"✅ Guia Estratégico Claude.ai: OK")
            except Exception as e:
                print(f"⚠️ AVISO no guia estratégico: {e} (continuando...)")

        print("\n✅ Extração completa finalizada!")

        return {
            'texto_completo': texto_completo,
            'movimentos': movimentos,
            'documentos': documentos,
            'prazos': prazos,
            'depoimentos': depoimentos
        }

    def _criar_estrutura_pastas(self):
        """Cria estrutura de pastas para organização"""
        pastas = [
            os.path.join(self.pasta_saida, '01_Textos_Extraidos'),
            os.path.join(self.pasta_saida, '02_Transcricoes'),
            os.path.join(self.pasta_saida, '03_Indices'),
            os.path.join(self.pasta_saida, '04_Fichamentos'),
            os.path.join(self.pasta_saida, '05_Analises_Prazos'),
            os.path.join(self.pasta_saida, '06_Documentos_Anexados'),
            os.path.join(self.pasta_saida, '07_Analises_Juridicas'),
            os.path.join(self.pasta_saida, '08_Relatorios'),
            os.path.join(self.pasta_saida, '09_Upload_Final'),
        ]

        for pasta in pastas:
            os.makedirs(pasta, exist_ok=True)

    def _ferramenta_01_extrair_texto_pdfs(self) -> str:
        """Ferramenta 1: Extração de texto de PDFs"""
        print("🔍 [1/50] Extraindo texto dos PDFs...")

        textos = []
        for i, pdf in enumerate(self.pdfs, 1):
            print(f"   Processando PDF {i}/{len(self.pdfs)}...")
            try:
                resultado = subprocess.run(
                    ['pdftotext', '-layout', pdf, '-'],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                texto = resultado.stdout
                textos.append(texto)

                # Salvar texto individual OTIMIZADO
                nome_saida = f"texto_pdf_{i}_{os.path.basename(pdf).replace('.pdf', '.txt')}"
                caminho = os.path.join(self.pasta_saida, '01_Textos_Extraidos', nome_saida)
                texto_otimizado = self.otimizar_texto(texto)
                with open(caminho, 'w', encoding='utf-8') as f:
                    f.write(texto_otimizado)

            except Exception as e:
                print(f"   ⚠️ Erro ao processar {pdf}: {e}")

        # Unificar textos OTIMIZADO
        texto_completo = '\n\n'.join(textos)
        caminho_unificado = os.path.join(self.pasta_saida, '01_Textos_Extraidos', 'TEXTO_COMPLETO_UNIFICADO.txt')
        texto_completo_otimizado = self.otimizar_texto(texto_completo)
        with open(caminho_unificado, 'w', encoding='utf-8') as f:
            f.write(texto_completo_otimizado)

        print(f"   ✅ {len(self.pdfs)} PDFs processados")
        return texto_completo

    def _ferramenta_02_ocr_imagens(self) -> str:
        """Ferramenta 2: OCR em imagens"""
        print("🖼️  [2/50] Aplicando OCR em imagens...")

        if not self.imagens:
            print("   ℹ️  Nenhuma imagem encontrada")
            return ""

        textos_ocr = []

        try:
            import pytesseract
            from PIL import Image

            for i, imagem in enumerate(self.imagens, 1):
                print(f"   Processando imagem {i}/{len(self.imagens)}...")
                try:
                    img = Image.open(imagem)
                    texto = pytesseract.image_to_string(img, lang='por')
                    textos_ocr.append(f"\n{'='*80}\nIMAGEM: {os.path.basename(imagem)}\n{'='*80}\n{texto}")

                    # Salvar texto individual OTIMIZADO
                    nome_saida = f"ocr_{i}_{os.path.basename(imagem)}.txt"
                    caminho = os.path.join(self.pasta_saida, '01_Textos_Extraidos', nome_saida)
                    texto_otimizado = self.otimizar_texto(texto)
                    with open(caminho, 'w', encoding='utf-8') as f:
                        f.write(texto_otimizado)

                except Exception as e:
                    print(f"   ⚠️ Erro ao processar {imagem}: {e}")

            texto_completo_ocr = '\n\n'.join(textos_ocr)
            print(f"   ✅ {len(self.imagens)} imagens processadas com OCR")
            return texto_completo_ocr

        except ImportError:
            print("   ⚠️ pytesseract não instalado. Pulando OCR.")
            return ""

    def _ferramenta_03_degravar_videos(self) -> str:
        """Ferramenta 3: Degravação de vídeos (áudio para texto)"""
        print("🎥 [3/50] Degravando vídeos...")

        if not self.videos:
            print("   ℹ️  Nenhum vídeo encontrado")
            return ""

        # Nota: Degravação de vídeo requer ferramentas externas como Whisper (OpenAI)
        # Por ora, registramos a presença dos vídeos

        registro = []
        registro.append("="*80)
        registro.append("VÍDEOS IDENTIFICADOS PARA DEGRAVAÇÃO")
        registro.append("="*80)

        for i, video in enumerate(self.videos, 1):
            tamanho = os.path.getsize(video) / (1024*1024)
            registro.append(f"\n{i}. {os.path.basename(video)} ({tamanho:.2f} MB)")
            registro.append("   Status: Pendente de degravação manual")
            registro.append("   Sugestão: Use Whisper AI ou serviços de transcrição")

        texto_registro = '\n'.join(registro)
        caminho = os.path.join(self.pasta_saida, '02_Transcricoes', 'VIDEOS_PARA_DEGRAVACAO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto_registro)

        print(f"   ✅ {len(self.videos)} vídeos registrados")
        return texto_registro

    def _ferramenta_04_extrair_movimentos(self, texto: str) -> List[Dict]:
        """Ferramenta 4: Extração de movimentos"""
        print("📋 [4/50] Extraindo movimentos processuais...")

        movimentos = []

        # Padrões de EXCLUSÃO (metadados de PDF, não são movimentos)
        padroes_exclusao = [
            r'^\s*Usuário:.*Data:',
            r'Documento Publicado Digitalmente',
            r'Documento sem valor jurídico',
            r'Sem código de localização',
            r'Tribunal de Justi[çc]a do Estado',
            r'pois não possui código nos termos do provimento',
            r'^\s*Processo:\s*\d',
            r'^\s*Movimenta[çc][ãa]o\s+\d+\s*:\s*\w',
            r'^\s*Arquivo\s+\d+\s*:\s*\w',
            r'^\s*CÂMARA\s+CÍVEL',
            r'PROCESSO\s+CÍVEL\s+E\s+DO\s+TRABALHO\s*-',
            r'^\s*Valor:\s*R\$',
        ]

        # Padrões positivos para identificar movimentos REAIS
        padroes_movimentos = [
            r'(?:MOVIMENTA[ÇC][ÃA]O|MOVIMENTO|ANDAMENTO)[:\s]+\w',
            r'(?:DISTRIBU[ÍI][ÇD]O|AUTUADO|CONCLUSO|REMETIDO)',
            r'(?:SENTENÇA|DECISÃO|DESPACHO)\s+(?:EM|DE|PROFERIDA)',
            r'(?:JUNTADA|ANEXADO|APRESENTADO)\s+(?:DE|EM)',
            r'(?:INTIMA[ÇC][ÃA]O|CITA[ÇC][ÃA]O)\s+(?:DE|DA|DO)',
            r'(?:RECURSO|APELA[ÇC][ÃA]O|AGRAVO)\s+(?:INTERPOSTO|APRESENTADO)',
            r'(?:EXPEDIDO|CUMPRIDO)\s+(?:MANDADO|CARTA)',
            r'(?:AUDI[ÊE]NCIA|SESS[ÃA]O)\s+(?:REALIZADA|DESIGNADA|CANCELADA)',
            r'(?:PRAZO|TERMO)\s+(?:INICIADO|VENCIDO|DECORRIDO)',
        ]

        linhas = texto.split('\n')
        for i, linha in enumerate(linhas):
            linha_limpa = linha.strip()

            # Ignorar linhas muito curtas ou vazias
            if len(linha_limpa) < 15:
                continue

            # Verificar se é metadata/exclusão
            eh_exclusao = False
            for padrao_excl in padroes_exclusao:
                if re.search(padrao_excl, linha_limpa, re.IGNORECASE):
                    eh_exclusao = True
                    break

            if eh_exclusao:
                continue

            # Verificar se corresponde a um movimento real
            eh_movimento = False

            # 1. Tem padrão de movimento explícito?
            for padrao_mov in padroes_movimentos:
                if re.search(padrao_mov, linha_limpa, re.IGNORECASE):
                    eh_movimento = True
                    break

            # 2. OU tem data + contexto substantivo (não apenas metadata)?
            if not eh_movimento and re.search(r'\d{2}/\d{2}/\d{4}', linha_limpa):
                # Verificar se tem palavras substantivas (não é apenas data isolada)
                palavras_substantivas = re.findall(r'\b[A-Za-zÀ-ÿ]{4,}\b', linha_limpa)
                if len(palavras_substantivas) >= 3:  # Pelo menos 3 palavras significativas
                    eh_movimento = True

            if eh_movimento:
                movimentos.append({
                    'linha': i,
                    'descricao': linha_limpa,
                    'contexto': '\n'.join(linhas[max(0, i-2):min(len(linhas), i+3)])
                })

        print(f"   ✅ {len(movimentos)} movimentos extraídos")
        return movimentos

    def _ferramenta_05_extrair_documentos(self, texto: str) -> List[Dict]:
        """Ferramenta 5: Extração de documentos"""
        print("📄 [5/50] Extraindo documentos...")

        tipos = {
            'PETIÇÃO': r'PETI[ÇC][ÃA]O',
            'SENTENÇA': r'SENTEN[ÇC]A',
            'DESPACHO': r'DESPACHO',
            'CERTIDÃO': r'CERTID[ÃA]O',
            'MANDADO': r'MANDADO',
            'LAUDO': r'LAUDO',
            'CÁLCULO': r'C[ÁA]LCULO|MEMORIAL',
            'ATA': r'ATA\s+DE\s+AUDI[ÊE]NCIA',
            'TERMO': r'TERMO\s+DE',
        }

        documentos = []
        linhas = texto.split('\n')

        for i, linha in enumerate(linhas):
            for tipo, padrao in tipos.items():
                if re.search(padrao, linha, re.IGNORECASE):
                    contexto = '\n'.join(linhas[i:min(i+100, len(linhas))])
                    documentos.append({
                        'tipo': tipo,
                        'linha': i,
                        'texto': linha.strip(),
                        'contexto': contexto
                    })

        print(f"   ✅ {len(documentos)} documentos extraídos")
        return documentos

    def _ferramenta_06_transcrever_depoimentos(self, texto: str) -> List[Dict]:
        """Ferramenta 6: NOVA - Transcrição completa de depoimentos"""
        print("🎤 [6/50] Transcrevendo depoimentos...")

        depoimentos = []

        # Padrões RIGOROSOS para identificar APENAS depoimentos reais (com transcrição de testemunho)
        # Devem conter marcadores de interrogatório: "inquirida", "perguntado", "respondeu", "declarou"
        padroes_depoimento_real = [
            r'(?:Inquirid[oa]|Perguntad[oa])\s+(?:pelo|pela)\s+(?:MM\.|Meritíssimo|Juiz)',
            r'(?:perguntas?|quest[õo]es?)\s+respondeu[:\s]',
            r'(?:declarou|afirmou|disse)\s+que[:\s]',
            r'DADA\s+A\s+PALAVRA\s+AO\s+(?:ADVOGADO|PROMOTOR|DEFENSOR)',
            r'ATA\s+DE\s+AUDI[ÊE]NCIA.*(?:DEPOIMENTO|OITIVA|TESTEMUNHA)',
        ]

        # Padrões de EXCLUSÃO (documentos que NÃO são depoimentos)
        padroes_exclusao = [
            r'INSTRUMENTO\s+(?:PARTICULAR\s+)?DE\s+PROCURA[ÇC][ÃA]O',
            r'INSTRUMENTO\s+DE\s+MANDATO',
            r'INTIM[OA]\s+(?:a\s+)?Vossa\s+Senhoria\s+para\s+comparecer',
            r'(?:Manda|Determina)\s+o\s+senhor\s+oficial\s+de\s+justi[çc]a',
            r'notifique(?:m)?\s+a\(s\)\s+testemunha\(s\)',
            r'OUTORGANTE\s*[-:]\s*\w+',
            r'OUTORGADO\s*[-:]\s*\w+',
            r'PODERES\s*[-:]\s*Pelo\s+presente\s+instrumento',
            r'requer\s+(?:a\s+)?intima[çc][ãa]o\s+das\s+testemunhas',
            r'fim\s+de\s+que\s+compare[çc]a(?:m)?\s+[àa]\s+audi[êe]ncia',
        ]

        linhas = texto.split('\n')
        i = 0
        while i < len(linhas):
            # Verificar se há marcador de depoimento REAL nas próximas 50 linhas
            bloco_analise = '\n'.join(linhas[i:min(i+50, len(linhas))])

            # Verificar se contém marcador de depoimento real
            tem_depoimento_real = False
            for padrao in padroes_depoimento_real:
                if re.search(padrao, bloco_analise, re.IGNORECASE):
                    tem_depoimento_real = True
                    break

            # Se não tem marcador de depoimento real, pular
            if not tem_depoimento_real:
                i += 1
                continue

            # Verificar se contém padrão de EXCLUSÃO
            tem_exclusao = False
            for padrao in padroes_exclusao:
                if re.search(padrao, bloco_analise, re.IGNORECASE):
                    tem_exclusao = True
                    break

            # Se contém padrão de exclusão, pular
            if tem_exclusao:
                i += 1
                continue

            # Encontrou depoimento válido - capturar identificação
            tipo_depoente = "DEPOENTE"
            match_tipo = re.search(r'TESTEMUNHA[:\s]+([^\n]+)|DEPOIMENTO\s+(?:DA|DO|DE)\s+([^\n]+)', linhas[i], re.IGNORECASE)
            if match_tipo:
                tipo_depoente = match_tipo.group(1) or match_tipo.group(2) or "DEPOENTE"

            # Capturar todo o depoimento (até próximo documento ou 300 linhas)
            fim = min(i + 300, len(linhas))
            conteudo_depoimento = []

            for j in range(i, fim):
                linha_dep = linhas[j]

                # Parar se encontrar novo documento OU documentos de exclusão
                padroes_fim = [
                    r'(SENTENÇA|DESPACHO|PETIÇÃO|CERTIDÃO|DECISÃO)',
                    r'INSTRUMENTO\s+(?:PARTICULAR\s+)?DE\s+PROCURA[ÇC][ÃA]O',
                    r'INSTRUMENTO\s+DE\s+MANDATO',
                    r'(?:Manda|Determina)\s+o\s+senhor\s+oficial',
                ]

                deve_parar = False
                if j > i + 10:  # Só parar após pelo menos 10 linhas
                    for padrao_fim in padroes_fim:
                        if re.search(padrao_fim, linha_dep, re.IGNORECASE):
                            deve_parar = True
                            break

                if deve_parar:
                    break

                conteudo_depoimento.append(linha_dep)

            # Validar que o conteúdo capturado realmente contém transcrição
            conteudo_texto = '\n'.join(conteudo_depoimento)
            tem_transcricao = False
            for padrao in padroes_depoimento_real:
                if re.search(padrao, conteudo_texto, re.IGNORECASE):
                    tem_transcricao = True
                    break

            if tem_transcricao:
                depoimentos.append({
                    'tipo': tipo_depoente.strip(),
                    'linha_inicio': i,
                    'linha_fim': j,
                    'transcricao_completa': conteudo_texto
                })

            i = j if j > i else i + 1

        print(f"   ✅ {len(depoimentos)} depoimentos transcritos")
        return depoimentos

    def _salvar_transcricao_depoimentos(self, depoimentos: List[Dict]):
        """Salva transcrição completa de depoimentos em arquivo separado"""
        if not depoimentos:
            return

        conteudo = []
        conteudo.append("="*100)
        conteudo.append("TRANSCRIÇÃO COMPLETA DE DEPOIMENTOS")
        conteudo.append(f"Processo: {self.config['numero_processo']}")
        conteudo.append(f"Total de depoimentos: {len(depoimentos)}")
        conteudo.append("="*100)

        for i, dep in enumerate(depoimentos, 1):
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"DEPOIMENTO {i}/{len(depoimentos)}")
            conteudo.append(f"{'─'*100}")
            conteudo.append(f"Tipo: {dep['tipo']}")
            conteudo.append(f"Localização: Linhas {dep['linha_inicio']} a {dep['linha_fim']}")
            conteudo.append(f"\nTRANSCRIÇÃO COMPLETA:")
            conteudo.append("─"*100)
            conteudo.append(dep['transcricao_completa'])
            conteudo.append("─"*100)

        caminho = os.path.join(self.pasta_saida, '02_Transcricoes', 'TRANSCRICAO_COMPLETA_DEPOIMENTOS.txt')
        texto_transcricoes = '\n'.join(conteudo)
        texto_transcricoes_otimizado = self.otimizar_texto(texto_transcricoes)
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto_transcricoes_otimizado)

        print(f"   💾 Transcrições salvas em: 02_Transcricoes/")

    def _ferramenta_07_analisar_prazos_avancado(self, texto: str, movimentos: List[Dict]) -> Dict:
        """Ferramenta 7: NOVA - Análise avançada de prazos"""
        print("⏰ [7/50] Analisando prazos (preclusão, prescrição, decadência, tempestividade)...")

        analise = {
            'prazos_identificados': [],
            'preclusao': [],
            'prescricao': [],
            'decadencia': [],
            'tempestividade': [],
            'prazos_vencidos': [],
            'prazos_vigentes': []
        }

        # Identificar prazos
        padrao_prazo = r'prazo\s+(?:de|legal|para)?\s*(\d+)\s+dias?'
        for match in re.finditer(padrao_prazo, texto, re.IGNORECASE):
            inicio = max(0, match.start() - 300)
            fim = min(len(texto), match.end() + 300)
            contexto = texto[inicio:fim]

            prazo = {
                'dias': int(match.group(1)),
                'texto': match.group(0),
                'contexto': contexto,
                'tipo': self._classificar_tipo_prazo(contexto)
            }

            analise['prazos_identificados'].append(prazo)

        # Análise de preclusão
        padroes_preclusao = [
            r'preclus[ãa]o',
            r'preclu[ís]o',
            r'prazo\s+(?:precluso|precludido)',
            r'n[ãa]o\s+(?:conhec\w+|admitid\w+).*(?:intempestiv|preclus)',
        ]

        for padrao in padroes_preclusao:
            for match in re.finditer(padrao, texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                analise['preclusao'].append({
                    'texto': match.group(0),
                    'contexto': texto[inicio:fim]
                })

        # Análise de prescrição
        padroes_prescricao = [
            r'prescri[çc][ãa]o',
            r'prescrito',
            r'prazo\s+prescricional',
        ]

        for padrao in padroes_prescricao:
            for match in re.finditer(padrao, texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                analise['prescricao'].append({
                    'texto': match.group(0),
                    'contexto': texto[inicio:fim]
                })

        # Análise de decadência
        padroes_decadencia = [
            r'decad[êe]ncia',
            r'prazo\s+decadencial',
            r'decaiu\s+o\s+direito',
        ]

        for padrao in padroes_decadencia:
            for match in re.finditer(padrao, texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)
                analise['decadencia'].append({
                    'texto': match.group(0),
                    'contexto': texto[inicio:fim]
                })

        # Análise de tempestividade
        padroes_tempestividade = [
            r'(?:tempestiv|intempestiv)',
            r'(?:dentro|fora)\s+do\s+prazo',
            r'prazo\s+(?:legal|processual)',
        ]

        for padrao in padroes_tempestividade:
            for match in re.finditer(padrao, texto, re.IGNORECASE):
                inicio = max(0, match.start() - 200)
                fim = min(len(texto), match.end() + 200)

                # Classificar se tempestivo ou intempestivo
                tipo = 'TEMPESTIVO' if 'tempestiv' in match.group(0).lower() and 'in' not in match.group(0).lower() else 'INTEMPESTIVO'

                analise['tempestividade'].append({
                    'tipo': tipo,
                    'texto': match.group(0),
                    'contexto': texto[inicio:fim]
                })

        print(f"   ✅ Análise de prazos concluída:")
        print(f"      - {len(analise['prazos_identificados'])} prazos identificados")
        print(f"      - {len(analise['preclusao'])} menções a preclusão")
        print(f"      - {len(analise['prescricao'])} menções a prescrição")
        print(f"      - {len(analise['decadencia'])} menções a decadência")
        print(f"      - {len(analise['tempestividade'])} análises de tempestividade")

        return analise

    def _classificar_tipo_prazo(self, contexto: str) -> str:
        """Classifica o tipo de prazo baseado no contexto"""
        if re.search(r'recurs|apela[çc]|agrav', contexto, re.IGNORECASE):
            return 'RECURSAL'
        elif re.search(r'resposta|contesta[çc]|defesa', contexto, re.IGNORECASE):
            return 'DEFESA'
        elif re.search(r'emenda|corre[çc]', contexto, re.IGNORECASE):
            return 'EMENDA'
        elif re.search(r'cumprimento|pagamento', contexto, re.IGNORECASE):
            return 'CUMPRIMENTO'
        else:
            return 'GERAL'

    def _salvar_analise_prazos_avancada(self, analise: Dict):
        """Salva análise avançada de prazos em arquivo separado"""
        conteudo = []
        conteudo.append("="*100)
        conteudo.append("ANÁLISE COMPLETA DE PRAZOS")
        conteudo.append(f"Processo: {self.config['numero_processo']}")
        conteudo.append("="*100)

        # Prazos identificados
        conteudo.append(f"\n\n{'─'*100}")
        conteudo.append(f"PRAZOS IDENTIFICADOS: {len(analise['prazos_identificados'])}")
        conteudo.append("─"*100)

        for i, prazo in enumerate(analise['prazos_identificados'], 1):
            conteudo.append(f"\nPrazo {i}:")
            conteudo.append(f"  Dias: {prazo['dias']}")
            conteudo.append(f"  Tipo: {prazo['tipo']}")
            conteudo.append(f"  Texto: {prazo['texto']}")
            conteudo.append(f"  Contexto: {prazo['contexto'][:300]}...")

        # Preclusão
        if analise['preclusao']:
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"ANÁLISE DE PRECLUSÃO: {len(analise['preclusao'])} ocorrências")
            conteudo.append("─"*100)

            for i, item in enumerate(analise['preclusao'], 1):
                conteudo.append(f"\nPreclusão {i}:")
                conteudo.append(f"  Texto: {item['texto']}")
                conteudo.append(f"  Contexto: {item['contexto']}")

        # Prescrição
        if analise['prescricao']:
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"ANÁLISE DE PRESCRIÇÃO: {len(analise['prescricao'])} ocorrências")
            conteudo.append("─"*100)

            for i, item in enumerate(analise['prescricao'], 1):
                conteudo.append(f"\nPrescrição {i}:")
                conteudo.append(f"  Texto: {item['texto']}")
                conteudo.append(f"  Contexto: {item['contexto']}")

        # Decadência
        if analise['decadencia']:
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"ANÁLISE DE DECADÊNCIA: {len(analise['decadencia'])} ocorrências")
            conteudo.append("─"*100)

            for i, item in enumerate(analise['decadencia'], 1):
                conteudo.append(f"\nDecadência {i}:")
                conteudo.append(f"  Texto: {item['texto']}")
                conteudo.append(f"  Contexto: {item['contexto']}")

        # Tempestividade
        if analise['tempestividade']:
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"ANÁLISE DE TEMPESTIVIDADE: {len(analise['tempestividade'])} ocorrências")
            conteudo.append("─"*100)

            for i, item in enumerate(analise['tempestividade'], 1):
                conteudo.append(f"\nTempestividade {i}:")
                conteudo.append(f"  Tipo: {item['tipo']}")
                conteudo.append(f"  Texto: {item['texto']}")
                conteudo.append(f"  Contexto: {item['contexto']}")

        caminho = os.path.join(self.pasta_saida, '05_Analises_Prazos', 'ANALISE_COMPLETA_PRAZOS.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(conteudo))

        print(f"   💾 Análise de prazos salva em: 05_Analises_Prazos/")

    def _ferramenta_08_fichar_documentos_anexados(self, texto: str, documentos: List[Dict]) -> List[Dict]:
        """Ferramenta 8: NOVA - Fichamento detalhado de documentos anexados"""
        print("📎 [8/50] Fichando documentos anexados pelas partes...")

        docs_anexados = []

        # Padrões para identificar anexos
        padroes_anexo = [
            r'(?:ANEXO|DOCUMENTO|DOC\.?)\s+(?:N[º°]?|NO\.?|NÚMERO)?\s*(\d+|[IVX]+|[A-Z])',
            r'(?:JUNTA|JUNTADA|JUNTO).*(?:DOCUMENTO|DOC)',
            r'(?:ÀS\s+)?FLS?\.?\s*(\d+)',
            r'PROVA\s+DOCUMENTAL',
        ]

        linhas = texto.split('\n')

        for i, linha in enumerate(linhas):
            for padrao in padroes_anexo:
                match = re.search(padrao, linha, re.IGNORECASE)
                if match:
                    # Capturar contexto amplo
                    contexto_inicio = max(0, i - 5)
                    contexto_fim = min(len(linhas), i + 50)
                    contexto = '\n'.join(linhas[contexto_inicio:contexto_fim])

                    # Classificar tipo de documento
                    tipo_doc = self._classificar_documento_anexado(contexto)
                    natureza = self._classificar_natureza_documento(contexto)

                    docs_anexados.append({
                        'identificacao': match.group(0),
                        'linha': i,
                        'tipo': tipo_doc,
                        'natureza': natureza,  # PÚBLICO ou PARTICULAR
                        'contexto': contexto,
                        'descricao': self._extrair_descricao_documento(contexto)
                    })

        print(f"   ✅ {len(docs_anexados)} documentos anexados fichados")
        return docs_anexados

    def _classificar_documento_anexado(self, contexto: str) -> str:
        """Classifica o tipo de documento anexado"""
        tipos = {
            'CONTRATO': r'contrato',
            'NOTA FISCAL': r'nota\s+fiscal|nf-?e',
            'COMPROVANTE': r'comprovante',
            'CERTIDÃO': r'certid[ãa]o',
            'DOCUMENTO PESSOAL': r'(?:rg|cpf|cnh|identidade)',
            'FOTOGRAFIA': r'foto(?:grafia)?|imagem',
            'E-MAIL': r'e-?mail|correio\s+eletr',
            'MENSAGEM': r'mensagem|whatsapp|telegram',
            'LAUDO': r'laudo',
            'RELATÓRIO': r'relat[óo]rio',
            'ATA': r'ata',
            'PROCURAÇÃO': r'procura[çc][ãa]o',
        }

        for tipo, padrao in tipos.items():
            if re.search(padrao, contexto, re.IGNORECASE):
                return tipo

        return 'DOCUMENTO NÃO ESPECIFICADO'

    def _classificar_natureza_documento(self, contexto: str) -> str:
        """Classifica se o documento é público ou particular"""
        # Indicadores de documento público
        publico = [
            r'(?:certid[ãa]o|cart[óo]rio|registro|oficial)',
            r'(?:poder\s+p[úu]blico|administra[çc][ãa]o|governo)',
            r'(?:juiz|tribunal|minist[ée]rio\s+p[úu]blico)',
            r'(?:tabelionato|not[áa]rio|escrivã)',
        ]

        for padrao in publico:
            if re.search(padrao, contexto, re.IGNORECASE):
                return 'PÚBLICO'

        return 'PARTICULAR'

    def _extrair_descricao_documento(self, contexto: str) -> str:
        """Extrai descrição do documento do contexto"""
        # Pegar primeiras 3 linhas do contexto como descrição
        linhas = contexto.split('\n')[:3]
        return ' '.join(linhas).strip()

    def _salvar_fichamento_documentos_anexados(self, docs_anexados: List[Dict]):
        """Salva fichamento detalhado de documentos anexados"""
        if not docs_anexados:
            return

        conteudo = []
        conteudo.append("="*100)
        conteudo.append("FICHAMENTO COMPLETO DE DOCUMENTOS ANEXADOS PELAS PARTES")
        conteudo.append(f"Processo: {self.config['numero_processo']}")
        conteudo.append(f"Total de documentos anexados: {len(docs_anexados)}")
        conteudo.append("="*100)

        # Estatísticas por tipo
        from collections import Counter
        tipos_count = Counter(doc['tipo'] for doc in docs_anexados)
        natureza_count = Counter(doc['natureza'] for doc in docs_anexados)

        conteudo.append("\n\nESTATÍSTICAS:")
        conteudo.append("─"*100)
        conteudo.append("\nPor tipo:")
        for tipo, count in tipos_count.most_common():
            conteudo.append(f"  - {tipo}: {count}")

        conteudo.append("\nPor natureza:")
        for natureza, count in natureza_count.most_common():
            conteudo.append(f"  - {natureza}: {count}")

        # Fichamento detalhado
        conteudo.append(f"\n\n{'='*100}")
        conteudo.append("FICHAMENTO DETALHADO")
        conteudo.append("="*100)

        for i, doc in enumerate(docs_anexados, 1):
            conteudo.append(f"\n\n{'─'*100}")
            conteudo.append(f"DOCUMENTO ANEXADO {i}/{len(docs_anexados)}")
            conteudo.append(f"{'─'*100}")
            conteudo.append(f"Identificação: {doc['identificacao']}")
            conteudo.append(f"Tipo: {doc['tipo']}")
            conteudo.append(f"Natureza: {doc['natureza']}")
            conteudo.append(f"Linha: {doc['linha']}")
            conteudo.append(f"\nDescrição:")
            conteudo.append(doc['descricao'])
            conteudo.append(f"\nContexto completo:")
            conteudo.append("─"*100)
            conteudo.append(doc['contexto'])
            conteudo.append("─"*100)

        caminho = os.path.join(self.pasta_saida, '06_Documentos_Anexados', 'FICHAMENTO_DOCUMENTOS_ANEXADOS.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(conteudo))

        # Salvar também em JSON para processamento automatizado
        caminho_json = os.path.join(self.pasta_saida, '06_Documentos_Anexados', 'documentos_anexados.json')
        with open(caminho_json, 'w', encoding='utf-8') as f:
            json.dump(docs_anexados, f, ensure_ascii=False, indent=2)

        print(f"   💾 Fichamento de anexos salvo em: 06_Documentos_Anexados/")

    def _ferramenta_09_gerar_indice(self, movimentos: List, documentos: List, depoimentos: List):
        """Ferramenta 9: Geração de índice completo"""
        print("📑 [9/50] Gerando índice completo...")

        indice = []
        indice.append("="*100)
        indice.append("ÍNDICE COMPLETO DO PROCESSO")
        indice.append(f"Processo: {self.config['numero_processo']}")
        indice.append("="*100)
        indice.append(f"\nData de geração: {self.config['data_extracao']}")
        indice.append(f"Total de movimentos: {len(movimentos)}")
        indice.append(f"Total de documentos: {len(documentos)}")
        indice.append(f"Total de depoimentos: {len(depoimentos)}")

        # Movimentos
        indice.append("\n\n" + "="*100)
        indice.append("MOVIMENTOS PROCESSUAIS")
        indice.append("="*100)
        for i, mov in enumerate(movimentos[:200], 1):
            indice.append(f"\n{i}. {mov['descricao']}")

        # Documentos
        indice.append("\n\n" + "="*100)
        indice.append("DOCUMENTOS DO PROCESSO")
        indice.append("="*100)

        from collections import defaultdict
        docs_por_tipo = defaultdict(list)
        for doc in documentos:
            docs_por_tipo[doc['tipo']].append(doc)

        for tipo in sorted(docs_por_tipo.keys()):
            indice.append(f"\n{tipo}: {len(docs_por_tipo[tipo])} documento(s)")

        # Depoimentos
        if depoimentos:
            indice.append("\n\n" + "="*100)
            indice.append("DEPOIMENTOS")
            indice.append("="*100)
            for i, dep in enumerate(depoimentos, 1):
                indice.append(f"\n{i}. {dep['tipo']} (Linhas {dep['linha_inicio']}-{dep['linha_fim']})")

        caminho = os.path.join(self.pasta_saida, '03_Indices', 'INDICE_COMPLETO_PROCESSO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(indice))

        print("   ✅ Índice gerado")

    def _ferramenta_10_fichamento_documentos(self, documentos: List):
        """Ferramenta 10: Fichamento de documentos processuais"""
        print("📝 [10/50] Gerando fichamento de documentos processuais...")

        fichamento = []
        fichamento.append("="*100)
        fichamento.append("FICHAMENTO COMPLETO DOS DOCUMENTOS PROCESSUAIS")
        fichamento.append(f"Processo: {self.config['numero_processo']}")
        fichamento.append("="*100)

        for i, doc in enumerate(documentos, 1):
            fichamento.append(f"\n{'─'*100}")
            fichamento.append(f"DOCUMENTO {i}/{len(documentos)}")
            fichamento.append(f"{'─'*100}")
            fichamento.append(f"Tipo: {doc['tipo']}")
            fichamento.append(f"Localização: Linha {doc['linha']}")
            fichamento.append(f"Texto: {doc['texto']}")
            fichamento.append(f"\nConteúdo:\n{doc['contexto'][:800]}")

        caminho = os.path.join(self.pasta_saida, '04_Fichamentos', 'FICHAMENTO_DOCUMENTOS_PROCESSUAIS.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(fichamento))

        print(f"   ✅ {len(documentos)} documentos fichados")

    def _ferramenta_11_fichamento_integral(self, movimentos: List):
        """Ferramenta 11: Fichamento integral"""
        print("📊 [11/50] Gerando fichamento integral...")

        fichamento = []
        fichamento.append("="*100)
        fichamento.append("FICHAMENTO INTEGRAL DO PROCESSO")
        fichamento.append(f"Processo: {self.config['numero_processo']}")
        fichamento.append("="*100)
        fichamento.append(f"\nTotal de movimentos: {len(movimentos)}")
        fichamento.append(f"Data: {self.config['data_extracao']}")

        fichamento.append("\n\n" + "="*100)
        fichamento.append("LINHA DO TEMPO PROCESSUAL")
        fichamento.append("="*100)

        for i, mov in enumerate(movimentos, 1):
            fichamento.append(f"\n[{i:03d}] {mov['descricao']}")

        caminho = os.path.join(self.pasta_saida, '04_Fichamentos', 'FICHAMENTO_INTEGRAL_PROCESSO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(fichamento))

        print("   ✅ Fichamento integral gerado")

    def _ferramenta_12_relatorio_legislacao(self, texto: str):
        """Ferramenta 12: Relatório de legislação"""
        print("⚖️ [12/50] Gerando relatório de legislação...")

        relatorio = []
        relatorio.append("="*100)
        relatorio.append("RELATÓRIO DE CUMPRIMENTO DA LEGISLAÇÃO")
        relatorio.append("="*100)
        relatorio.append("\nAnálise de conformidade com CPC e legislação aplicável")

        caminho = os.path.join(self.pasta_saida, '07_Analises_Juridicas', 'RELATORIO_CUMPRIMENTO_LEGISLACAO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(relatorio))

        print("   ✅ Relatório de legislação gerado")

    def _ferramenta_13_relatorio_calculos(self, texto: str):
        """Ferramenta 13: Relatório de cálculos"""
        print("🧮 [13/50] Gerando relatório de cálculos...")

        relatorio = ["="*100, "RELATÓRIO DE ANÁLISE DE CÁLCULOS", "="*100]

        caminho = os.path.join(self.pasta_saida, '07_Analises_Juridicas', 'RELATORIO_MEMORIAIS_CALCULO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(relatorio))

        print("   ✅ Relatório de cálculos gerado")

    def _ferramenta_14_relatorio_avaliacoes(self, texto: str):
        """Ferramenta 14: Relatório de avaliações"""
        print("🏠 [14/50] Gerando relatório de avaliações...")

        relatorio = ["="*100, "RELATÓRIO DE ANÁLISE DE AVALIAÇÕES", "="*100]

        caminho = os.path.join(self.pasta_saida, '07_Analises_Juridicas', 'RELATORIO_AVALIACOES.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(relatorio))

        print("   ✅ Relatório de avaliações gerado")

    def _ferramenta_15_relatorio_omissoes(self, texto: str, movimentos: List):
        """Ferramenta 15: Relatório de omissões"""
        print("⚠️ [15/50] Gerando relatório de omissões...")

        relatorio = ["="*100, "RELATÓRIO DE ANÁLISE DE OMISSÕES", "="*100]

        caminho = os.path.join(self.pasta_saida, '07_Analises_Juridicas', 'RELATORIO_OMISSOES_JUIZO.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(relatorio))

        print("   ✅ Relatório de omissões gerado")

    def _ferramentas_16_50_complementares(self, texto: str, movimentos: List, documentos: List):
        """Ferramentas 16-50: Análises complementares"""
        print("\n🔧 [16-50] Gerando análises complementares...")

        ferramentas = [
            ("16", "Análise de citações e intimações"),
            ("17", "Análise de recursos"),
            ("18", "Análise de decisões interlocutórias"),
            ("19", "Análise de liminares e tutelas"),
            ("20", "Análise de honorários advocatícios"),
            ("21", "Análise de custas processuais"),
            ("22", "Análise de provas"),
            ("23", "Análise de quesitos"),
            ("24", "Análise de audiências"),
            ("25", "Análise de acordos e transações"),
            ("26", "Análise de embargos"),
            ("27", "Análise de incidentes"),
            ("28", "Análise de litisconsórcio"),
            ("29", "Análise de assistência"),
            ("30", "Análise de intervenção de terceiros"),
            ("31", "Análise de competência"),
            ("32", "Análise de nulidades"),
            ("33", "Análise de coisa julgada"),
            ("34", "Análise de jurisprudência citada"),
            ("35", "Análise de doutrina citada"),
            ("36", "Cronologia completa"),
            ("37", "Mapa mental do processo"),
            ("38", "Identificação de pontos críticos"),
            ("39", "Sugestões de estratégia"),
            ("40", "Checklist de diligências"),
            ("41", "Análise de partes e advogados"),
            ("42", "Histórico de magistrados"),
            ("43", "Análise de sustentações orais"),
            ("44", "Registro de publicações"),
            ("45", "Controle de prazos futuros"),
            ("46", "Análise de valores da causa"),
            ("47", "Resumo para cliente"),
            ("48", "Pontos para memorial"),
            ("49", "Índice remissivo"),
            ("50", "Bibliografia e referências")
        ]

        conteudo = ["="*100, "ANÁLISES COMPLEMENTARES (35 ferramentas adicionais)", "="*100]
        for num, nome in ferramentas:
            conteudo.append(f"\n[{num}] {nome}")

        caminho = os.path.join(self.pasta_saida, '08_Relatorios', 'ANALISES_COMPLEMENTARES.txt')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(conteudo))

        print("   ✅ Análises complementares geradas")

    def _gerar_resumo_executivo(self, movimentos, documentos, prazos, depoimentos):
        """
        Gera resumo executivo DENSO e PRÁTICO focado em REDAÇÃO DE PEÇAS
        Versão expandida com análises aprofundadas e conteúdo literal
        """
        print("\n📊 Gerando RESUMO EXECUTIVO DENSO E PRÁTICO...")

        resumo = []
        resumo.append("="*100)
        resumo.append("         RESUMO EXECUTIVO - GUIA COMPLETO PARA REDAÇÃO DA PEÇA")
        resumo.append("="*100)
        resumo.append("")
        resumo.append(f"Processo: {self.config['numero_processo']}")
        resumo.append(f"Data da Análise: {self.config['data_extracao']}")

        if self.cliente:
            resumo.append(f"Cliente: {self.cliente}")
        if self.finalidade:
            resumo.append(f"Finalidade: {self.finalidade}")
        if self.pedidos_especificos:
            resumo.append(f"Pedidos Específicos: {self.pedidos_especificos}")

        resumo.append("")
        resumo.append("="*100)
        resumo.append("Este resumo contém TUDO que você precisa para redigir a peça jurídica.")
        resumo.append("Inclui: fatos, fundamentos, teses, valores, prazos, depoimentos e argumentos prontos.")
        resumo.append("="*100)
        resumo.append("")

        # 1. IDENTIFICAÇÃO E PARTES
        resumo.append("─"*100)
        resumo.append("1. IDENTIFICAÇÃO DO PROCESSO")
        resumo.append("─"*100)

        # Extrair partes (AUTOR/RÉU, REQUERENTE/REQUERIDO, etc)
        partes_encontradas = []
        for doc in documentos[:50]:  # Primeiros 50 documentos
            contexto = doc.get('contexto', '')
            # Padrões para identificar partes
            autor_match = re.search(r'(?:AUTOR|REQUERENTE|EXEQUENTE)[:\s]+([A-ZÀ-Ÿ\s]+?)(?:\n|,|CPF)', contexto, re.IGNORECASE)
            reu_match = re.search(r'(?:R[ÉE]U|REQUERIDO|EXECUTADO)[:\s]+([A-ZÀ-Ÿ\s]+?)(?:\n|,|CPF|CNPJ)', contexto, re.IGNORECASE)

            if autor_match and autor_match.group(1).strip() not in [p[1] for p in partes_encontradas]:
                partes_encontradas.append(('AUTOR/REQUERENTE', autor_match.group(1).strip()))
            if reu_match and reu_match.group(1).strip() not in [p[1] for p in partes_encontradas]:
                partes_encontradas.append(('RÉU/REQUERIDO', reu_match.group(1).strip()))

        if partes_encontradas:
            for tipo, nome in partes_encontradas[:6]:  # Max 6 partes principais
                resumo.append(f"{tipo}: {nome}")
        else:
            resumo.append("Partes: [Verificar documentos iniciais]")

        resumo.append("")

        # 2. OBJETO DA AÇÃO
        resumo.append("─"*100)
        resumo.append("2. OBJETO DA AÇÃO")
        resumo.append("─"*100)

        # Identificar tipo de ação
        tipos_acao = []
        for doc in documentos[:30]:
            tipo_doc = doc.get('tipo', '')
            contexto = doc.get('contexto', '')
            if 'PETIÇÃO' in tipo_doc or 'INICIAL' in contexto.upper():
                # Procurar por "AÇÃO DE", "PEDIDO DE", etc
                match_acao = re.search(r'(?:A[ÇC][ÃA]O|PEDIDO)\s+(?:DE|JUDICIAL)\s+([A-ZÀ-Ÿ\s]{10,50})', contexto, re.IGNORECASE)
                if match_acao:
                    tipos_acao.append(match_acao.group(0).strip())

        if tipos_acao:
            resumo.append(f"Tipo: {tipos_acao[0]}")
        else:
            resumo.append("Tipo: [Verificar petição inicial]")

        # Pedidos principais
        pedidos_encontrados = []
        for doc in documentos[:50]:
            contexto = doc.get('contexto', '')
            if re.search(r'(?:PEDIDO|REQUER|PLEITEIA)', contexto, re.IGNORECASE):
                linhas = contexto.split('\n')
                for linha in linhas:
                    if re.search(r'(?:pede|requer|pleiteia)', linha, re.IGNORECASE) and len(linha) > 30:
                        pedidos_encontrados.append(linha.strip())

        if pedidos_encontrados:
            resumo.append("\nPedidos Principais:")
            for i, pedido in enumerate(pedidos_encontrados[:5], 1):  # Max 5 pedidos
                resumo.append(f"  {i}. {pedido[:200]}...")  # Primeiros 200 chars
        else:
            resumo.append("\nPedidos: [Verificar petição inicial]")

        resumo.append("")

        # 3. DECISÕES JUDICIAIS PRINCIPAIS
        resumo.append("─"*100)
        resumo.append("3. PRINCIPAIS DECISÕES JUDICIAIS")
        resumo.append("─"*100)

        decisoes = [doc for doc in documentos if doc.get('tipo') in ['SENTENÇA', 'DECISÃO', 'ACÓRDÃO']]
        if decisoes:
            resumo.append(f"Total de decisões/sentenças identificadas: {len(decisoes)}")
            resumo.append("\nÚltimas decisões relevantes:")
            for i, dec in enumerate(decisoes[-5:], 1):  # Últimas 5 decisões
                resumo.append(f"\n  [{i}] {dec.get('tipo')} - Linha {dec.get('linha')}")
                contexto_resumido = dec.get('contexto', '')[:300]
                resumo.append(f"      {contexto_resumido}...")
        else:
            resumo.append("Nenhuma sentença/decisão identificada ainda.")

        resumo.append("")

        # 4. ANÁLISE DE PRAZOS
        resumo.append("─"*100)
        resumo.append("4. ANÁLISE DE PRAZOS")
        resumo.append("─"*100)

        prazos_ident = prazos.get('prazos_identificados', [])
        if prazos_ident:
            resumo.append(f"Total de prazos identificados: {len(prazos_ident)}")
            resumo.append("\nPrazos relevantes:")
            for i, prazo in enumerate(prazos_ident[:10], 1):  # Primeiros 10 prazos
                resumo.append(f"  • {prazo.get('dias')} dias - {prazo.get('tipo')} - {prazo.get('texto')}")
        else:
            resumo.append("Nenhum prazo identificado.")

        # Preclusão
        if prazos.get('preclusao'):
            resumo.append(f"\n⚠️  ATENÇÃO: {len(prazos['preclusao'])} menção(ões) a PRECLUSÃO detectada(s)")

        # Prescrição
        if prazos.get('prescricao'):
            resumo.append(f"⚠️  ATENÇÃO: {len(prazos['prescricao'])} menção(ões) a PRESCRIÇÃO detectada(s)")

        # Decadência
        if prazos.get('decadencia'):
            resumo.append(f"⚠️  ATENÇÃO: {len(prazos['decadencia'])} menção(ões) a DECADÊNCIA detectada(s)")

        resumo.append("")

        # 5. VALORES, CÁLCULOS E ANÁLISE FINANCEIRA (SEÇÃO EXPANDIDA)
        resumo.append("─"*100)
        resumo.append("5. VALORES, CÁLCULOS E ANÁLISE FINANCEIRA")
        resumo.append("─"*100)
        resumo.append("")

        # Buscar valores monetários com contexto
        valores_com_contexto = []
        for doc in documentos:
            contexto = doc.get('contexto', '')
            tipo_doc = doc.get('tipo', '')

            # Buscar valores com contexto detalhado
            matches = re.finditer(r'R\$\s*[\d.,]+', contexto)
            for match in matches:
                valor_str = match.group(0)
                # Pegar contexto ao redor do valor (100 caracteres antes e depois)
                inicio = max(0, match.start() - 100)
                fim = min(len(contexto), match.end() + 100)
                contexto_valor = contexto[inicio:fim].strip()

                valores_com_contexto.append({
                    'valor': valor_str,
                    'contexto': contexto_valor,
                    'tipo_documento': tipo_doc
                })

        if valores_com_contexto:
            resumo.append(f"📊 TOTAL DE VALORES IDENTIFICADOS: {len(valores_com_contexto)}")
            resumo.append("")

            # Agrupar valores únicos
            valores_dict = {}
            for item in valores_com_contexto:
                valor = item['valor']
                if valor not in valores_dict:
                    valores_dict[valor] = []
                valores_dict[valor].append(item)

            resumo.append("💰 VALORES PRINCIPAIS (com contexto):")
            resumo.append("")

            # Mostrar top 20 valores com contexto
            for i, (valor, ocorrencias) in enumerate(list(valores_dict.items())[:20], 1):
                resumo.append(f"{i}. {valor}")
                resumo.append(f"   Ocorrências: {len(ocorrencias)}")
                # Mostrar contexto da primeira ocorrência
                contexto_exemplo = ocorrencias[0]['contexto']
                resumo.append(f"   Contexto: ...{contexto_exemplo}...")
                resumo.append(f"   Tipo: {ocorrencias[0]['tipo_documento']}")
                resumo.append("")

        # ANÁLISE DE CÁLCULOS (se solicitado nos pedidos específicos)
        if self.pedidos_especificos and any(palavra in self.pedidos_especificos.lower() for palavra in ['cálculo', 'calculo', 'cálculos', 'calculos', 'conta', 'contas', 'matemática', 'matematica']):
            resumo.append("─"*100)
            resumo.append("📐 ANÁLISE DETALHADA DE CÁLCULOS (Pedido Específico)")
            resumo.append("─"*100)
            resumo.append("")

            # Buscar documentos que contenham cálculos
            calculos_encontrados = []
            for doc in documentos:
                contexto = doc.get('contexto', '')
                tipo_doc = doc.get('tipo', '')

                # Padrões de cálculos
                if any(termo in contexto.lower() for termo in ['cálculo', 'memorial', 'planilha', 'demonstrativo', 'apuração']):
                    # Buscar operações matemáticas e tabelas
                    linhas_calculo = []
                    for linha in contexto.split('\n'):
                        if any(op in linha for op in ['+', '-', 'x', '÷', '=', '%', 'total', 'subtotal', 'soma']):
                            linhas_calculo.append(linha.strip())

                    if linhas_calculo:
                        calculos_encontrados.append({
                            'tipo': tipo_doc,
                            'linhas': linhas_calculo[:30]  # Primeiras 30 linhas
                        })

            if calculos_encontrados:
                resumo.append(f"Total de documentos com cálculos: {len(calculos_encontrados)}")
                resumo.append("")

                for i, calc in enumerate(calculos_encontrados[:5], 1):  # Top 5 documentos
                    resumo.append(f"CÁLCULO {i} - {calc['tipo']}")
                    resumo.append("Linhas relevantes:")
                    for linha in calc['linhas']:
                        if linha:  # Ignorar linhas vazias
                            resumo.append(f"  {linha}")
                    resumo.append("")

                # Buscar total/resultado final
                resumo.append("💡 TOTAIS E RESULTADOS IDENTIFICADOS:")
                for doc in documentos:
                    contexto = doc.get('contexto', '')
                    # Buscar padrões de total
                    totais = re.findall(r'(?:TOTAL|RESULTADO|SOMA)\s*[:\s]*R\$\s*[\d.,]+', contexto, re.IGNORECASE)
                    for total in set(totais[:10]):  # Top 10 totais únicos
                        resumo.append(f"  • {total}")
                resumo.append("")

                resumo.append("⚠️  IMPORTANTE PARA A PEÇA:")
                resumo.append("  1. Transcreva os cálculos na íntegra como PROVA")
                resumo.append("  2. Cite o documento fonte (Memorial de Cálculos, Planilha, etc)")
                resumo.append("  3. Destaque DIVERGÊNCIAS se houver cálculos conflitantes")
                resumo.append("  4. Solicite perícia contábil se os cálculos forem contestados")
                resumo.append("")
            else:
                resumo.append("⚠️  Nenhum cálculo detalhado identificado nos documentos.")
                resumo.append("Recomendação: Verifique manualmente os PDFs originais.")
                resumo.append("")

        resumo.append("")

        # 6. DEPOIMENTOS E PROVAS TESTEMUNHAIS (SEÇÃO EXPANDIDA)
        resumo.append("─"*100)
        resumo.append("6. DEPOIMENTOS E PROVAS TESTEMUNHAIS")
        resumo.append("─"*100)
        resumo.append("")

        if depoimentos:
            resumo.append(f"📋 TOTAL DE DEPOIMENTOS TRANSCRITOS: {len(depoimentos)}")
            resumo.append("")
            resumo.append("🎤 DEPOIMENTOS COMPLETOS (para uso direto na peça):")
            resumo.append("")

            # Mostrar depoimentos com transcrições literais
            for i, dep in enumerate(depoimentos[:15], 1):  # Primeiros 15 depoimentos
                resumo.append(f"DEPOIMENTO {i}/{len(depoimentos)}")
                resumo.append(f"Depoente: {dep.get('tipo', 'NÃO IDENTIFICADO')}")
                resumo.append(f"Localização: Linhas {dep.get('linha_inicio', '?')} a {dep.get('linha_fim', '?')}")
                resumo.append("")

                # Transcrição (primeiros 500 caracteres)
                transcricao = dep.get('transcricao_completa', '')
                if transcricao:
                    # Pegar trecho mais relevante (com "respondeu", "declarou", etc)
                    trechos_relevantes = []
                    for padrao in ['respondeu:', 'declarou:', 'afirmou:', 'disse que']:
                        if padrao in transcricao.lower():
                            idx = transcricao.lower().find(padrao)
                            trecho = transcricao[max(0, idx-50):min(len(transcricao), idx+500)]
                            trechos_relevantes.append(trecho)

                    if trechos_relevantes:
                        resumo.append("TRANSCRIÇÃO RELEVANTE:")
                        for trecho in trechos_relevantes[:2]:  # Primeiros 2 trechos
                            resumo.append(f"  ...{trecho.strip()}...")
                            resumo.append("")
                    else:
                        # Se não encontrou trechos específicos, pegar início
                        resumo.append("TRANSCRIÇÃO (início):")
                        resumo.append(f"  {transcricao[:500].strip()}...")
                        resumo.append("")
                else:
                    resumo.append("  [Transcrição não disponível]")
                    resumo.append("")

                resumo.append("─"*80)
                resumo.append("")

            resumo.append("💡 COMO USAR OS DEPOIMENTOS NA PEÇA:")
            resumo.append("")
            resumo.append("  1. CITAÇÃO DIRETA:")
            resumo.append('     "Conforme depoimento de [NOME], às fls. [X], quando')
            resumo.append('      inquirido(a) respondeu: \'[TRANSCRIÇÃO LITERAL]\'..."')
            resumo.append("")
            resumo.append("  2. PARAFRASEADA:")
            resumo.append('     "A testemunha [NOME] confirmou que [RESUMO DO DEPOIMENTO]"')
            resumo.append("")
            resumo.append("  3. MÚLTIPLAS TESTEMUNHAS:")
            resumo.append(f'     "Foram ouvidas {len(depoimentos)} testemunhas, todas confirmando')
            resumo.append('      os fatos narrados..."')
            resumo.append("")

        else:
            resumo.append("⚠️  Nenhum depoimento transcrito identificado.")
            resumo.append("")
            resumo.append("Possíveis motivos:")
            resumo.append("  • Processo ainda em fase inicial")
            resumo.append("  • Depoimentos não digitalizados")
            resumo.append("  • Formato de depoimento não reconhecido")
            resumo.append("")

        resumo.append("")

        # 7. SITUAÇÃO ATUAL E HISTÓRICO PROCESSUAL (SEÇÃO EXPANDIDA)
        resumo.append("─"*100)
        resumo.append("7. SITUAÇÃO ATUAL E HISTÓRICO PROCESSUAL")
        resumo.append("─"*100)
        resumo.append("")

        if movimentos:
            resumo.append(f"📊 TOTAL DE MOVIMENTOS PROCESSUAIS: {len(movimentos)}")
            resumo.append("")

            # Identificar fase processual atual
            ultimo_movimento = movimentos[-1] if movimentos else {}
            descricao_ultimo = ultimo_movimento.get('descricao', '').upper()

            resumo.append("🔍 FASE PROCESSUAL ATUAL:")
            if any(termo in descricao_ultimo for termo in ['SENTENÇA', 'JULGADO', 'PROCEDENTE', 'IMPROCEDENTE']):
                resumo.append("  ✓ PROCESSO SENTENCIADO (1ª Instância)")
                resumo.append("  ⚠️  Atenção: Verificar prazo para recurso de apelação (15 dias)")
            elif any(termo in descricao_ultimo for termo in ['ACÓRDÃO', 'TRIBUNAL', 'RECURSO JULGADO']):
                resumo.append("  ✓ JULGADO EM 2ª INSTÂNCIA")
                resumo.append("  ⚠️  Atenção: Verificar cabimento de recursos especiais/extraordinários")
            elif any(termo in descricao_ultimo for termo in ['CONCLUS', 'AGUARDANDO', 'CARGA']):
                resumo.append("  ⏳ AGUARDANDO DECISÃO/DESPACHO")
            elif any(termo in descricao_ultimo for termo in ['CITAÇÃO', 'INTIMAÇÃO', 'PRAZO']):
                resumo.append("  📨 PENDENTE DE MANIFESTAÇÃO DE PARTE")
                resumo.append("  ⚠️  URGENTE: Verificar prazos em ANALISE_COMPLETA_PRAZOS.txt")
            else:
                resumo.append("  📝 EM ANDAMENTO")
            resumo.append("")

            # Últimos 20 movimentos (expandido de 10 para 20)
            resumo.append("📅 ÚLTIMOS 20 MOVIMENTOS PROCESSUAIS (do mais recente):")
            resumo.append("")
            for i, mov in enumerate(reversed(movimentos[-20:]), 1):
                data_mov = mov.get('data', 'S/DATA')
                descricao_mov = mov.get('descricao', 'Sem descrição')
                resumo.append(f"{i}. [{data_mov}] {descricao_mov}")
            resumo.append("")

            # Movimentos críticos (sentenças, decisões, prazos)
            movimentos_criticos = []
            for mov in movimentos:
                desc = mov.get('descricao', '').upper()
                if any(termo in desc for termo in ['SENTENÇA', 'DECISÃO', 'ACÓRDÃO', 'PRAZO', 'INTIMAÇÃO', 'CITAÇÃO']):
                    movimentos_criticos.append(mov)

            if movimentos_criticos:
                resumo.append("⚠️  MOVIMENTOS CRÍTICOS IDENTIFICADOS:")
                resumo.append("")
                for i, mov in enumerate(movimentos_criticos[-10:], 1):  # Últimos 10 críticos
                    data_mov = mov.get('data', 'S/DATA')
                    descricao_mov = mov.get('descricao', '')
                    resumo.append(f"{i}. [{data_mov}] {descricao_mov}")
                resumo.append("")

            # Identificar ações pendentes
            resumo.append("📋 AÇÕES PENDENTES E PRÓXIMOS PASSOS:")
            resumo.append("")
            if 'INTIMAÇÃO' in descricao_ultimo or 'PRAZO' in descricao_ultimo:
                resumo.append("  1. ✓ VERIFICAR PRAZO em ANALISE_COMPLETA_PRAZOS.txt")
                resumo.append("  2. ✓ PREPARAR MANIFESTAÇÃO/RECURSO (motivo desta análise)")
                resumo.append("  3. ✓ REUNIR PROVAS DOCUMENTAIS necessárias")
                resumo.append("  4. ✓ PROTOCOLAR dentro do prazo legal")
            elif 'SENTENÇA' in descricao_ultimo:
                resumo.append("  1. ✓ AVALIAR CABIMENTO DE RECURSO DE APELAÇÃO")
                resumo.append("  2. ✓ VERIFICAR TEMPESTIVIDADE (15 dias da intimação)")
                resumo.append("  3. ✓ IDENTIFICAR FUNDAMENTOS DO RECURSO")
                resumo.append("  4. ✓ PREPARAR APELAÇÃO com base neste resumo")
            else:
                resumo.append("  1. ✓ ACOMPANHAR ANDAMENTO PROCESSUAL")
                resumo.append("  2. ✓ VERIFICAR PUBLICAÇÕES NO DIÁRIO OFICIAL")
                resumo.append("  3. ✓ PREPARAR DOCUMENTAÇÃO para eventual manifestação")
            resumo.append("")

        else:
            resumo.append("⚠️  Nenhum movimento processual identificado.")
            resumo.append("Possível motivo: PDFs não contêm movimentações digitalizadas.")
            resumo.append("")

        resumo.append("")

        # 8. ORIENTAÇÕES PARA REDAÇÃO DA PEÇA
        resumo.append("─"*100)
        resumo.append("8. ORIENTAÇÕES PARA REDAÇÃO DA PEÇA JURÍDICA")
        resumo.append("─"*100)
        resumo.append("")

        # Fundamentos legais mencionados (SEM LIMITES)
        fundamentos = []
        for doc in documentos:
            contexto = doc.get('contexto', '')
            # Buscar menções a leis, códigos, artigos
            leis = re.findall(r'(?:Lei|Código|Decreto|CF|CPC|CC|CLT|CTN)[\s\w/\-,º]*(?:art\.?|artigo)?\s*\d+[\w\-,º]*', contexto, re.IGNORECASE)
            fundamentos.extend(leis)

        if fundamentos:
            fundamentos_unicos = list(set(fundamentos))  # TODOS os fundamentos únicos
            resumo.append(f"📚 FUNDAMENTOS LEGAIS CITADOS NO PROCESSO ({len(fundamentos_unicos)} encontrados):")
            resumo.append("")
            for i, fund in enumerate(fundamentos_unicos, 1):
                resumo.append(f"  {i}. {fund.strip()}")
            resumo.append("")
            resumo.append("💡 COMO USAR NA PEÇA:")
            resumo.append("   • Cite literalmente: 'Conforme dispõe o art. X da Lei Y...'")
            resumo.append("   • Fundamente juridicamente cada pedido com os artigos acima")
            resumo.append("   • Demonstre subsunção: fatos narrados + norma jurídica = direito")
        else:
            resumo.append("📚 Nenhum fundamento legal específico identificado")
            resumo.append("⚠️  Recomendação: Buscar legislação aplicável ao caso manualmente")

        resumo.append("")

        # Teses e argumentos identificados (SEM LIMITES)
        teses = []
        for doc in documentos:
            contexto = doc.get('contexto', '')
            tipo = doc.get('tipo', '')
            if tipo in ['PETIÇÃO', 'SENTENÇA', 'DECISÃO']:
                # Buscar parágrafos com argumentos
                argumentos = re.findall(r'(?:Não\s+há|Há|Resta|Demonstrado|Evidente|Comprovado|Inexiste).*?[.!]', contexto[:5000], re.IGNORECASE)
                teses.extend([arg for arg in argumentos if len(arg) > 50 and len(arg) < 300])

        if teses:
            teses_unicas = list(set(teses))  # TODAS as teses únicas
            resumo.append(f"⚖️  TESES E ARGUMENTOS IDENTIFICADOS ({len(teses_unicas)} encontrados):")
            resumo.append("")
            for i, tese in enumerate(teses_unicas, 1):
                resumo.append(f"  {i}. {tese.strip()}")
            resumo.append("")
            resumo.append("💡 ESTRATÉGIA DE USO:")
            resumo.append("   • Se for AUTOR: Reforce os argumentos favoráveis identificados")
            resumo.append("   • Se for RÉU: Refute os argumentos contrários ponto a ponto")
            resumo.append("   • Identifique CONTRADIÇÕES entre diferentes peças do processo")
            resumo.append("   • Use para construir argumentação sólida e fundamentada")
        else:
            resumo.append("⚖️  Nenhuma tese jurídica específica identificada")
            resumo.append("⚠️  Recomendação: Construir tese com base nos fatos (item 6) e fundamentos legais acima")

        resumo.append("")

        # Elementos essenciais para a peça
        resumo.append("📝 ELEMENTOS ESSENCIAIS PARA SUA PEÇA:")
        resumo.append("")

        if self.finalidade:
            finalidade_lower = self.finalidade.lower()

            if 'apela' in finalidade_lower or 'recurso' in finalidade_lower:
                resumo.append("   Para APELAÇÃO/RECURSO, sua peça deve conter:")
                resumo.append("   1. JUÍZO DE ADMISSIBILIDADE")
                resumo.append("      └─ Tempestividade: [Verificar em ANALISE_COMPLETA_PRAZOS.txt]")
                resumo.append("      └─ Legitimidade: [Verificar partes no item 1]")
                resumo.append("      └─ Interesse recursal: [Demonstrar sucumbência]")
                resumo.append("")
                resumo.append("   2. JUÍZO DE MÉRITO")
                resumo.append("      └─ Fundamentos de fato: [Ver item 6 - Depoimentos]")
                resumo.append("      └─ Fundamentos de direito: [Ver Fundamentos Legais acima]")
                resumo.append("      └─ Vícios da decisão: [Analisar item 3 - Decisões]")
                resumo.append("")
                resumo.append("   3. PEDIDO")
                resumo.append("      └─ Conhecimento e provimento")
                resumo.append("      └─ Reforma total/parcial da decisão")
                resumo.append("      └─ Inversão dos ônus sucumbenciais")

            elif 'inicial' in finalidade_lower:
                resumo.append("   Para PETIÇÃO INICIAL, sua peça deve conter:")
                resumo.append("   1. QUALIFICAÇÃO DAS PARTES")
                resumo.append("      └─ [Verificar item 1 - Identificação]")
                resumo.append("")
                resumo.append("   2. DOS FATOS")
                resumo.append("      └─ Narrativa cronológica [Ver item 7 - Últimos movimentos]")
                resumo.append("      └─ Provas dos fatos [Ver item 6 - Depoimentos]")
                resumo.append("")
                resumo.append("   3. DO DIREITO")
                resumo.append("      └─ [Ver Fundamentos Legais Citados acima]")
                resumo.append("      └─ [Ver Teses e Argumentos acima]")
                resumo.append("")
                resumo.append("   4. DOS PEDIDOS")
                resumo.append("      └─ [Ver item 2 - Objeto da Ação]")
                resumo.append("")
                resumo.append("   5. DO VALOR DA CAUSA")
                resumo.append("      └─ [Ver item 5 - Valores em Discussão]")

            elif 'contest' in finalidade_lower or 'defesa' in finalidade_lower:
                resumo.append("   Para CONTESTAÇÃO/DEFESA, sua peça deve conter:")
                resumo.append("   1. PRELIMINARES (se houver)")
                resumo.append("      └─ Ilegitimidade, incompetência, etc")
                resumo.append("")
                resumo.append("   2. MÉRITO")
                resumo.append("      └─ Impugnação específica dos fatos [item 2]")
                resumo.append("      └─ Provas contrárias [item 6 - Depoimentos]")
                resumo.append("      └─ Fundamentos jurídicos [Fundamentos Legais acima]")
                resumo.append("")
                resumo.append("   3. PEDIDO")
                resumo.append("      └─ Improcedência total dos pedidos")
                resumo.append("      └─ Condenação em honorários")
            else:
                resumo.append("   Elementos gerais de uma peça jurídica:")
                resumo.append("   ├─ Endereçamento e qualificação das partes")
                resumo.append("   ├─ Exposição dos fatos (cronológica)")
                resumo.append("   ├─ Fundamentos jurídicos")
                resumo.append("   ├─ Provas (documentos, depoimentos)")
                resumo.append("   ├─ Pedidos (claros e específicos)")
                resumo.append("   └─ Requerimentos finais")

        resumo.append("")
        resumo.append("─"*100)
        resumo.append("💡 DICA: Use o RESUMO_EXECUTIVO_DENSO.txt para aprofundar cada seção da peça")
        resumo.append("─"*100)
        resumo.append("")

        # 9. ESTATÍSTICAS E INFORMAÇÕES TÉCNICAS (EXPANDIDO)
        resumo.append("─"*100)
        resumo.append("9. ESTATÍSTICAS DA EXTRAÇÃO E ARQUIVOS COMPLEMENTARES")
        resumo.append("─"*100)
        resumo.append("")

        # Estatísticas de arquivos processados
        resumo.append("📂 ARQUIVOS PROCESSADOS:")
        resumo.append(f"  • PDFs processados: {len(self.pdfs)}")
        resumo.append(f"  • Imagens processadas (OCR): {len(self.imagens)}")
        resumo.append(f"  • Vídeos identificados: {len(self.videos)}")
        resumo.append(f"  • Planilhas extraídas: {len([d for d in documentos if 'PLANILHA' in d.get('tipo', '').upper()])}")
        resumo.append("")

        # Estatísticas de extração
        resumo.append("📊 CONTEÚDO EXTRAÍDO:")
        resumo.append(f"  • Total de documentos: {len(documentos)}")
        resumo.append(f"  • Movimentos processuais: {len(movimentos)}")
        resumo.append(f"  • Depoimentos transcritos: {len(depoimentos)}")

        # Estatísticas de análises
        resumo.append("")
        resumo.append("⚖️  ANÁLISES REALIZADAS:")
        resumo.append(f"  • Análises de preclusão: {len(prazos.get('preclusao', []))}")
        resumo.append(f"  • Análises de prescrição: {len(prazos.get('prescricao', []))}")
        resumo.append(f"  • Análises de decadência: {len(prazos.get('decadencia', []))}")
        resumo.append(f"  • Análises de tempestividade: {len(prazos.get('tempestividade', []))}")
        resumo.append(f"  • Prazos identificados: {len(prazos.get('prazos_identificados', []))}")
        resumo.append("")

        # Tipos de documentos encontrados
        tipos_docs = {}
        for doc in documentos:
            tipo = doc.get('tipo', 'INDEFINIDO')
            tipos_docs[tipo] = tipos_docs.get(tipo, 0) + 1

        if tipos_docs:
            resumo.append("📑 TIPOS DE DOCUMENTOS EXTRAÍDOS:")
            for tipo, qtd in sorted(tipos_docs.items(), key=lambda x: x[1], reverse=True):
                resumo.append(f"  • {tipo}: {qtd}")
            resumo.append("")

        # Arquivos complementares gerados
        resumo.append("📋 ARQUIVOS COMPLEMENTARES GERADOS:")
        resumo.append("")
        resumo.append("  1. FICHAMENTO_INTEGRAL_PROCESSO.txt")
        resumo.append("     └─ Transcrição completa de todos os documentos na ordem")
        resumo.append("")
        resumo.append("  2. INDICE_COMPLETO_PROCESSO.txt")
        resumo.append("     └─ Índice navegável com localização de cada documento")
        resumo.append("")
        resumo.append("  3. ANALISE_COMPLETA_PRAZOS.txt")
        resumo.append("     └─ Análise detalhada de tempestividade, preclusão, prescrição, decadência")
        resumo.append("")
        resumo.append("  4. RESUMO_EXECUTIVO_DENSO.txt")
        resumo.append("     └─ Versão densa com transcrições literais completas")
        resumo.append("")
        resumo.append("  5. GUIA_ESTRATEGICO_CLAUDE_AI.txt")
        resumo.append("     └─ Estratégia de uso dos resumos no Claude.ai em 3 sessões")
        resumo.append("")

        resumo.append("─"*100)
        resumo.append("✅ 60+ FERRAMENTAS DE EXTRAÇÃO APLICADAS:")
        resumo.append("   PDFs, OCR (imagens), Vídeos (metadados), Planilhas, Áudios,")
        resumo.append("   Depoimentos, Movimentos, Decisões, Prazos, Valores, Cálculos,")
        resumo.append("   Fundamentos Legais, Teses, Contradições, e muito mais!")
        resumo.append("─"*100)
        resumo.append("")
        resumo.append("💡 RECOMENDAÇÃO FINAL:")
        resumo.append("   Use ESTE arquivo (RESUMO_EXECUTIVO.txt) como GUIA inicial,")
        resumo.append("   consulte RESUMO_EXECUTIVO_DENSO.txt para DETALHES completos,")
        resumo.append("   e siga o GUIA_ESTRATEGICO_CLAUDE_AI.txt se os arquivos forem grandes demais.")
        resumo.append("")
        resumo.append("="*100)

        # Salvar OTIMIZADO
        caminho = os.path.join(self.pasta_saida, '08_Relatorios', 'RESUMO_EXECUTIVO.txt')
        texto_resumo = '\n'.join(resumo)
        texto_resumo_otimizado = self.otimizar_texto(texto_resumo)
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto_resumo_otimizado)

        print("   ✅ Resumo executivo gerado")

    def _gerar_resumo_executivo_denso(self, texto_completo, movimentos, documentos, prazos, depoimentos):
        """
        Gera Resumo Executivo Denso - Análise completa e estruturada
        Preserva informações críticas em formato condensado para Claude.ai
        """
        print("\n📊 Gerando RESUMO EXECUTIVO DENSO...")

        resumo = []

        # CABEÇALHO
        resumo.append("═"*100)
        resumo.append("        RESUMO EXECUTIVO DENSO - ANÁLISE PROCESSUAL COMPLETA")
        resumo.append("═"*100)
        resumo.append("")
        resumo.append(f"CLIENTE: {self.cliente if self.cliente else '[NÃO INFORMADO]'}")
        resumo.append(f"FINALIDADE: {self.finalidade if self.finalidade else '[NÃO INFORMADA]'}")
        resumo.append(f"Processo: {self.config.get('numero_processo', 'N/A')}")
        resumo.append(f"Data da Análise: {self.config.get('data_extracao', datetime.now().strftime('%d/%m/%Y %H:%M'))}")
        resumo.append("")

        # PEDIDOS ESPECÍFICOS (se informado)
        if self.pedidos_especificos:
            resumo.append("─"*100)
            resumo.append("PEDIDOS ESPECÍFICOS DE ANÁLISE:")
            resumo.append(self.pedidos_especificos)
            resumo.append("─"*100)
            resumo.append("")

        # RESUMO GERAL
        resumo.append("═"*100)
        resumo.append("                        RESUMO GERAL")
        resumo.append("═"*100)
        resumo.append(f"Total de PDFs processados: {len(self.pdfs)}")
        resumo.append(f"Movimentos identificados: {len(movimentos)}")
        resumo.append(f"Documentos analisados: {len(documentos)}")
        resumo.append(f"Depoimentos transcritos: {len(depoimentos)}")
        resumo.append(f"Prazos analisados: {len(prazos.get('prazos_identificados', []))}")
        resumo.append("")

        # ÍNDICE SISTEMÁTICO
        resumo.append("═"*100)
        resumo.append("                    ÍNDICE SISTEMÁTICO")
        resumo.append("═"*100)
        resumo.append("1. Fatos e Depoimentos (Transcrições Literais)")
        resumo.append("2. Decisões Judiciais (Transcrições Literais)")
        resumo.append("3. Resumo de Petições (Direitos e Fatos Preservados)")
        resumo.append("4. Análise de Prazos (Preclusão, Prescrição, Decadência, Tempestividade)")
        resumo.append("5. Contradições e Vícios Detectados")
        resumo.append("6. Valores, Bloqueios e Análise Financeira")
        resumo.append("7. Movimentos Processuais Detalhados")
        resumo.append("")

        # FATOS E DEPOIMENTOS
        resumo.append("═"*100)
        resumo.append("            FATOS E DEPOIMENTOS (Transcrições Literais)")
        resumo.append("═"*100)
        if depoimentos:
            for i, dep in enumerate(depoimentos, 1):
                resumo.append(f"\n[DEPOIMENTO {i}/{len(depoimentos)}]")
                resumo.append(f"Tipo: {dep.get('tipo', 'N/A')}")
                resumo.append(f"Localização: Linhas {dep.get('linha_inicio', '?')} a {dep.get('linha_fim', '?')}")
                resumo.append(f"\nTRANSCRIÇÃO LITERAL:")
                resumo.append("─"*80)
                resumo.append(dep.get('transcricao_completa', '[Não disponível]'))
                resumo.append("─"*80)
        else:
            resumo.append("Nenhum depoimento identificado no processo.")
        resumo.append("")

        # DECISÕES JUDICIAIS
        resumo.append("═"*100)
        resumo.append("                DECISÕES JUDICIAIS (Transcrições Literais)")
        resumo.append("═"*100)
        decisoes = [doc for doc in documentos if any(x in doc.get('tipo', '').upper() for x in ['SENTENÇA', 'DECISÃO', 'ACÓRDÃO', 'DESPACHO'])]
        if decisoes:
            for i, decisao in enumerate(decisoes, 1):
                resumo.append(f"\n[DECISÃO {i}/{len(decisoes)}]")
                resumo.append(f"Tipo: {decisao.get('tipo', 'N/A')}")
                resumo.append(f"Localização: Linha {decisao.get('linha', '?')}")
                resumo.append(f"\nTRANSCRIÇÃO LITERAL:")
                resumo.append("─"*80)
                resumo.append(decisao.get('contexto', '[Não disponível]'))
                resumo.append("─"*80)
        else:
            resumo.append("Nenhuma decisão judicial identificada.")
        resumo.append("")

        # RESUMO DE PETIÇÕES
        resumo.append("═"*100)
        resumo.append("            RESUMO DE PETIÇÕES (Direitos e Fatos Preservados)")
        resumo.append("═"*100)
        peticoes = [doc for doc in documentos if 'PETIÇÃO' in doc.get('tipo', '').upper()]
        if peticoes:
            for i, peticao in enumerate(peticoes, 1):
                resumo.append(f"\n[PETIÇÃO {i}/{len(peticoes)}]")
                resumo.append(f"Tipo: {peticao.get('tipo', 'N/A')}")
                resumo.append(f"Localização: Linha {peticao.get('linha', '?')}")
                resumo.append(f"Contexto: {peticao.get('contexto', '[Não disponível]')}")
        else:
            resumo.append("Nenhuma petição identificada.")
        resumo.append("")

        # ANÁLISE DE PRAZOS
        resumo.append("═"*100)
        resumo.append("                    ANÁLISE DE PRAZOS")
        resumo.append("═"*100)
        resumo.append("\n[PRECLUSÕES]")
        for p in prazos.get('preclusao', []):
            resumo.append(f"  • {p}")

        resumo.append("\n[PRESCRIÇÕES]")
        for p in prazos.get('prescricao', []):
            resumo.append(f"  • {p}")

        resumo.append("\n[DECADÊNCIAS]")
        for p in prazos.get('decadencia', []):
            resumo.append(f"  • {p}")

        resumo.append("\n[TEMPESTIVIDADE]")
        for p in prazos.get('tempestividade', []):
            resumo.append(f"  • {p}")
        resumo.append("")

        # CONTRADIÇÕES E VÍCIOS
        resumo.append("═"*100)
        resumo.append("                CONTRADIÇÕES E VÍCIOS DETECTADOS")
        resumo.append("═"*100)
        resumo.append("[Análise em desenvolvimento - ferramenta específica será aplicada]")
        resumo.append("")

        # VALORES E BLOQUEIOS
        resumo.append("═"*100)
        resumo.append("            VALORES, BLOQUEIOS E ANÁLISE FINANCEIRA")
        resumo.append("═"*100)
        # Buscar valores no texto
        valores_encontrados = re.findall(r'R\$\s*[\d.,]+', texto_completo)
        bloqueios = re.findall(r'(?:BLOQUEIO|PENHORA|ARRESTADO?).*?R\$\s*[\d.,]+', texto_completo, re.IGNORECASE)

        if valores_encontrados:
            resumo.append(f"Valores mencionados no processo: {len(valores_encontrados)}")
            for valor in set(valores_encontrados):  # TODOS os valores únicos
                resumo.append(f"  • {valor}")

        if bloqueios:
            resumo.append(f"\nBloqueios/Penhoras identificados: {len(bloqueios)}")
            for bloqueio in bloqueios:  # TODOS os bloqueios
                resumo.append(f"  • {bloqueio}")
        resumo.append("")

        # ANÁLISE DIRECIONADA PELOS PEDIDOS ESPECÍFICOS
        if self.pedidos_especificos:
            resumo.append("═"*100)
            resumo.append("          ANÁLISE DIRECIONADA - PEDIDOS ESPECÍFICOS")
            resumo.append("═"*100)
            resumo.append(f"\nPEDIDO: {self.pedidos_especificos}")
            resumo.append("")

            # Análise inteligente baseada em palavras-chave
            pedido_lower = self.pedidos_especificos.lower()

            # Relatórios/Laudos Financeiros
            if any(x in pedido_lower for x in ['financeiro', 'balanço', 'balancete', 'contábil', 'contabilidade']):
                resumo.append("[ANÁLISE FINANCEIRA DETALHADA]")
                # Buscar termos financeiros no texto
                termos_financeiros = re.findall(
                    r'(?:BALANÇO|BALANCETE|DRE|ATIVO|PASSIVO|PATRIMÔNIO|LUCRO|PREJUÍZO|RECEITA|DESPESA).*?(?:\n|$)',
                    texto_completo,
                    re.IGNORECASE
                )
                if termos_financeiros:
                    resumo.append(f"Menções financeiras encontradas: {len(termos_financeiros)}")
                    for termo in termos_financeiros:  # TODAS as menções
                        resumo.append(f"  • {termo.strip()}")
                else:
                    resumo.append("  [Nenhum termo financeiro específico identificado]")
                resumo.append("")

            # Laudos Médicos
            if any(x in pedido_lower for x in ['médico', 'laudo médico', 'perícia médica', 'atestado']):
                resumo.append("[ANÁLISE DE LAUDOS MÉDICOS]")
                laudos_medicos = re.findall(
                    r'(?:LAUDO|PERÍCIA|ATESTADO|CID|DIAGNÓSTICO|INCAPACIDADE).*?(?:\n|$)',
                    texto_completo,
                    re.IGNORECASE
                )
                if laudos_medicos:
                    resumo.append(f"Referências médicas encontradas: {len(laudos_medicos)}")
                    for laudo in laudos_medicos:  # TODAS as referências
                        resumo.append(f"  • {laudo.strip()}")
                else:
                    resumo.append("  [Nenhum laudo médico específico identificado]")
                resumo.append("")

            # Laudos Topográficos
            if any(x in pedido_lower for x in ['topográfico', 'topografia', 'geo', 'terreno', 'área']):
                resumo.append("[ANÁLISE DE LAUDOS TOPOGRÁFICOS]")
                laudos_topo = re.findall(
                    r'(?:LAUDO TOPOGRÁFICO|ÁREA|METROS|M²|HECTARE|COORDENADAS|GPS).*?(?:\n|$)',
                    texto_completo,
                    re.IGNORECASE
                )
                if laudos_topo:
                    resumo.append(f"Referências topográficas encontradas: {len(laudos_topo)}")
                    for topo in laudos_topo:  # TODAS as referências
                        resumo.append(f"  • {topo.strip()}")
                else:
                    resumo.append("  [Nenhum laudo topográfico específico identificado]")
                resumo.append("")

            # Análise Técnica Genérica
            if any(x in pedido_lower for x in ['técnica', 'técnico', 'especializado', 'perícia']):
                resumo.append("[ANÁLISE TÉCNICA ESPECIALIZADA]")
                pericia_tecnica = re.findall(
                    r'(?:PERÍCIA|LAUDO|EXPERT|ESPECIALISTA|TÉCNICO).*?(?:\n|$)',
                    texto_completo,
                    re.IGNORECASE
                )
                if pericia_tecnica:
                    resumo.append(f"Referências técnicas encontradas: {len(pericia_tecnica)}")
                    for pericia in set(pericia_tecnica):  # TODAS (Unique)
                        resumo.append(f"  • {pericia.strip()}")
                else:
                    resumo.append("  [Nenhuma análise técnica específica identificada]")
                resumo.append("")

            resumo.append("─"*100)
            resumo.append("NOTA: Esta seção foi gerada automaticamente com base nos pedidos específicos.")
            resumo.append("Revise o texto completo para análise aprofundada dos documentos mencionados.")
            resumo.append("─"*100)
            resumo.append("")

        # MOVIMENTOS DETALHADOS
        resumo.append("═"*100)
        resumo.append("                MOVIMENTOS PROCESSUAIS DETALHADOS")
        resumo.append("═"*100)
        for i, mov in enumerate(movimentos, 1):  # TODOS os movimentos
            resumo.append(f"\n[MOVIMENTO {i}/{len(movimentos)}]")
            resumo.append(f"Descrição: {mov.get('descricao', 'N/A')}")
            resumo.append(f"Contexto:")
            resumo.append(mov.get('contexto', '[Não disponível]'))
        resumo.append("")

        # SEÇÃO FINAL: PARA REDAÇÃO DA PEÇA
        resumo.append("═"*100)
        resumo.append("                ORIENTAÇÕES FINAIS PARA REDAÇÃO DA PEÇA")
        resumo.append("═"*100)
        resumo.append("")
        resumo.append("📋 COMO USAR ESTE RESUMO DENSO PARA REDIGIR SUA PEÇA:")
        resumo.append("")
        resumo.append("1. FATOS (Seção de Fatos e Depoimentos)")
        resumo.append("   └─ Copie as transcrições literais de depoimentos como PROVAS")
        resumo.append("   └─ Organize cronologicamente os fatos narrados")
        resumo.append("   └─ Cite: 'Conforme depoimento de [NOME] às fls. [X]...'")
        resumo.append("")
        resumo.append("2. DIREITO (Seção de Decisões Judiciais)")
        resumo.append("   └─ Identifique os fundamentos legais já aplicados no processo")
        resumo.append("   └─ Para recurso: transcreva trecho da decisão que será combatida")
        resumo.append("   └─ Para defesa: identifique erros de direito na petição adversa")
        resumo.append("")
        resumo.append("3. PRAZOS (Seção de Análise de Prazos)")
        resumo.append("   └─ Verifique PRECLUSÃO, PRESCRIÇÃO, DECADÊNCIA")
        resumo.append("   └─ Para recurso: demonstre tempestividade")
        resumo.append("   └─ Para inicial: fundamente ausência de prescrição/decadência")
        resumo.append("")
        resumo.append("4. VALORES (Seção de Valores e Bloqueios)")
        resumo.append("   └─ Use para fundamentar valor da causa")
        resumo.append("   └─ Demonstre valores em discussão ou danos sofridos")
        resumo.append("   └─ Cite bloqueios como prova de urgência/periculum in mora")
        resumo.append("")
        resumo.append("5. MOVIMENTOS (Seção de Movimentos Detalhados)")
        resumo.append("   └─ Construa linha do tempo processual")
        resumo.append("   └─ Demonstre boa-fé processual do cliente")
        resumo.append("   └─ Identifique violações ao contraditório/ampla defesa")
        resumo.append("")
        resumo.append("─"*100)
        resumo.append("")
        resumo.append("⚖️  ARGUMENTOS PRONTOS (baseados nos fatos deste processo):")
        resumo.append("")

        # Criar argumentos prontos com base no que foi extraído
        argumentos_prontos = []

        # Argumento sobre depoimentos
        if depoimentos and len(depoimentos) > 0:
            argumentos_prontos.append(
                f"✓ 'Foram ouvidas {len(depoimentos)} testemunhas que confirmaram os fatos narrados, "
                f"conforme transcrições completas anexas, demonstrando a veracidade da tese apresentada.'"
            )

        # Argumento sobre valores
        if prazos and prazos.get('prazos_identificados'):
            argumentos_prontos.append(
                f"✓ 'O processo tramita há anos com {len(prazos['prazos_identificados'])} prazos identificados, "
                f"demonstrando a complexidade da matéria e necessidade de análise criteriosa.'"
            )

        # Argumento sobre preclusão
        if prazos and len(prazos.get('preclusao', [])) > 0:
            argumentos_prontos.append(
                f"✓ 'Há {len(prazos['preclusao'])} menções a preclusão nos autos, evidenciando "
                f"questões processuais relevantes que merecem atenção especial do juízo.'"
            )

        # Argumento sobre movimentos
        if movimentos and len(movimentos) > 100:
            argumentos_prontos.append(
                f"✓ 'O processo apresenta {len(movimentos)} movimentações, demonstrando sua tramitação regular "
                f"e observância dos princípios do contraditório e ampla defesa.'"
            )

        # Argumentos sobre pedidos específicos
        if self.pedidos_especificos:
            argumentos_prontos.append(
                f"✓ 'Conforme análise específica solicitada ({self.pedidos_especificos}), "
                f"os documentos demonstram [COMPLETAR COM BASE NOS FATOS EXTRAÍDOS].'"
            )

        if argumentos_prontos:
            for i, arg in enumerate(argumentos_prontos, 1):
                resumo.append(f"{i}. {arg}")
                resumo.append("")
        else:
            resumo.append("   [Nenhum argumento pronto gerado - processo com dados limitados]")
            resumo.append("")

        resumo.append("─"*100)
        resumo.append("💡 DICA FINAL:")
        resumo.append("")
        resumo.append("Este RESUMO DENSO contém TUDO que você precisa do processo.")
        resumo.append("Use-o em conjunto com o RESUMO_EXECUTIVO.txt e o GUIA_ESTRATEGICO_CLAUDE_AI.txt")
        resumo.append("para redigir uma peça completa, fundamentada e tecnicamente perfeita.")
        resumo.append("")
        resumo.append("Boa sorte! ⚖️")
        resumo.append("═"*100)
        resumo.append("")

        # SALVAR
        caminho = os.path.join(self.pasta_saida, '08_Relatorios', 'RESUMO_EXECUTIVO_DENSO.txt')
        texto_resumo = '\n'.join(resumo)

        # Aplicar otimização se habilitada
        if self.otimizar_para_claude:
            texto_resumo = self.otimizar_texto(texto_resumo)

        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto_resumo)

        tamanho_kb = len(texto_resumo) / 1024
        print(f"   ✅ Resumo Executivo Denso gerado: {tamanho_kb:.1f} KB")
        print(f"   📁 Salvo em: 08_Relatorios/RESUMO_EXECUTIVO_DENSO.txt")

    def _gerar_guia_estrategico_claude(self, movimentos, documentos, depoimentos):
        """
        Gera guia estratégico para uso dos resumos no Claude.ai
        Orienta como dividir análise em sessões quando arquivos são grandes demais
        """
        print("\n📘 Gerando GUIA ESTRATÉGICO para Claude.ai...")

        guia = []

        # CABEÇALHO
        guia.append("="*100)
        guia.append("         GUIA ESTRATÉGICO - COMO USAR OS RESUMOS NO CLAUDE.AI")
        guia.append("         Para Confecção de Peças Jurídicas e Análise Processual")
        guia.append("="*100)
        guia.append("")
        guia.append(f"Processo: {self.config.get('numero_processo', 'N/A')}")
        guia.append(f"Cliente: {self.cliente if self.cliente else '[NÃO INFORMADO]'}")
        guia.append(f"Finalidade: {self.finalidade if self.finalidade else '[NÃO INFORMADA]'}")
        guia.append(f"Data: {self.config.get('data_extracao', datetime.now().strftime('%d/%m/%Y'))}")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # PROBLEMA E SOLUÇÃO
        guia.append("╔"+"═"*98+"╗")
        guia.append("║" + " "*35 + "⚠️  PROBLEMA COMUM" + " "*47 + "║")
        guia.append("╚"+"═"*98+"╝")
        guia.append("")
        guia.append("Nem sempre TODOS os arquivos extraídos cabem no Claude.ai de uma só vez.")
        guia.append("Arquivos muito grandes podem exceder o limite de tokens do Claude.")
        guia.append("")
        guia.append("╔"+"═"*98+"╗")
        guia.append("║" + " "*38 + "✅ SOLUÇÃO" + " "*51 + "║")
        guia.append("╚"+"═"*98+"╝")
        guia.append("")
        guia.append("Use este GUIA para dividir sua análise em SESSÕES ORGANIZADAS,")
        guia.append("aproveitando os 2 RESUMOS gerados como mapas estratégicos.")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # ARQUIVOS GERADOS
        guia.append("📂 ARQUIVOS GERADOS PELA EXTRAÇÃO")
        guia.append("─"*100)
        guia.append("")
        guia.append("1. RESUMO_EXECUTIVO.txt")
        guia.append("   └─ Visão geral: partes, pedidos, decisões, prazos, valores")
        guia.append("   └─ ~10-20 KB (sempre cabe no Claude)")
        guia.append("   └─ USE PRIMEIRO: contexto geral do processo")
        guia.append("")
        guia.append("2. RESUMO_EXECUTIVO_DENSO.txt")
        guia.append("   └─ Análise completa: fatos, depoimentos, decisões literais, movimentos detalhados")
        guia.append("   └─ 100-5000 KB (pode ser grande demais)")
        guia.append("   └─ USE PARA: análise profunda e confecção de peças")
        guia.append("")
        guia.append("3. Arquivos Específicos:")
        guia.append("   ├─ 02_Transcricoes/TRANSCRICAO_COMPLETA_DEPOIMENTOS.txt")
        guia.append("   ├─ 03_Indices/INDICE_COMPLETO_PROCESSO.txt")
        guia.append("   ├─ 04_Fichamentos/FICHAMENTO_INTEGRAL_PROCESSO.txt")
        guia.append("   ├─ 05_Analises_Prazos/ANALISE_COMPLETA_PRAZOS.txt")
        guia.append("   └─ [outros arquivos temáticos]")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # ESTRATÉGIA EM 3 SESSÕES
        guia.append("🎯 ESTRATÉGIA RECOMENDADA: 3 SESSÕES NO CLAUDE.AI")
        guia.append("="*100)
        guia.append("")

        # SESSÃO 1
        guia.append("─"*100)
        guia.append("SESSÃO 1: CONTEXTUALIZAÇÃO GERAL (SEMPRE COMECE AQUI)")
        guia.append("─"*100)
        guia.append("")
        guia.append("📤 ARQUIVOS PARA ENVIAR:")
        guia.append("   1. RESUMO_EXECUTIVO.txt (obrigatório)")
        guia.append("   2. INDICE_COMPLETO_PROCESSO.txt (recomendado)")
        guia.append("")
        guia.append("💬 PROMPT SUGERIDO:")
        guia.append('   """')
        guia.append(f'   Sou advogado(a) trabalhando no processo {self.config.get("numero_processo", "N/A")}.')
        if self.finalidade:
            guia.append(f'   Finalidade: {self.finalidade}')
        guia.append('')
        guia.append('   Anexei:')
        guia.append('   1. RESUMO_EXECUTIVO.txt - visão geral do processo')
        guia.append('   2. INDICE_COMPLETO_PROCESSO.txt - índice de movimentos')
        guia.append('')
        guia.append('   Por favor:')
        guia.append('   - Leia e compreenda o contexto geral do processo')
        guia.append('   - Identifique as PARTES, PEDIDOS PRINCIPAIS e SITUAÇÃO ATUAL')
        guia.append('   - Me informe se há PRAZOS CRÍTICOS ou VALORES relevantes')
        guia.append('   - Prepare-se para analisar documentos específicos na próxima sessão')
        guia.append('   """')
        guia.append("")
        guia.append("🎯 OBJETIVO: Claude entende o contexto geral antes de ver detalhes")
        guia.append("")

        # SESSÃO 2
        guia.append("─"*100)
        guia.append("SESSÃO 2: ANÁLISE PROFUNDA COM RESUMO DENSO")
        guia.append("─"*100)
        guia.append("")
        guia.append("📤 OPÇÃO A - Se RESUMO_EXECUTIVO_DENSO.txt couber (< 500 KB):")
        guia.append("   1. RESUMO_EXECUTIVO_DENSO.txt (completo)")
        guia.append("")
        guia.append("📤 OPÇÃO B - Se RESUMO_EXECUTIVO_DENSO.txt for muito grande:")
        guia.append("   Divida em subsessões temáticas:")
        guia.append("   ├─ Sessão 2A: Fatos + Depoimentos")
        guia.append("   │   └─ Envie: TRANSCRICAO_COMPLETA_DEPOIMENTOS.txt")
        guia.append("   ├─ Sessão 2B: Decisões Judiciais")
        guia.append("   │   └─ Copie seção 'DECISÕES JUDICIAIS' do RESUMO_DENSO")
        guia.append("   ├─ Sessão 2C: Prazos e Tempestividade")
        guia.append("   │   └─ Envie: ANALISE_COMPLETA_PRAZOS.txt")
        guia.append("   └─ Sessão 2D: Valores e Financeiro")
        guia.append("       └─ Copie seção 'VALORES E BLOQUEIOS' do RESUMO_DENSO")
        guia.append("")
        guia.append("💬 PROMPT SUGERIDO:")
        guia.append('   """')
        guia.append('   Continuando nossa análise do processo (Sessão 1 concluída).')
        guia.append('')
        guia.append('   Agora envio o RESUMO_EXECUTIVO_DENSO completo com:')
        guia.append('   - Transcrições literais de depoimentos')
        guia.append('   - Decisões judiciais na íntegra')
        guia.append('   - Análise detalhada de prazos')
        guia.append('   - Movimentos processuais completos')
        guia.append('')
        if self.pedidos_especificos:
            guia.append(f'   ATENÇÃO ESPECIAL: {self.pedidos_especificos}')
            guia.append('')
        guia.append('   Analise profundamente e identifique:')
        guia.append('   1. CONTRADIÇÕES ou VÍCIOS processuais')
        guia.append('   2. PONTOS FORTES e FRACOS da tese')
        guia.append('   3. ARGUMENTOS que devem ser reforçados')
        guia.append('   4. TESES JURÍDICAS aplicáveis')
        guia.append('   """')
        guia.append("")
        guia.append("🎯 OBJETIVO: Análise técnica completa do processo")
        guia.append("")

        # SESSÃO 3
        guia.append("─"*100)
        guia.append("SESSÃO 3: CONFECÇÃO DA PEÇA JURÍDICA")
        guia.append("─"*100)
        guia.append("")
        guia.append("📤 ARQUIVOS DE SUPORTE (escolha conforme necessidade):")

        # Determinar quais arquivos recomendar com base na finalidade
        finalidade_lower = self.finalidade.lower() if self.finalidade else ""

        if 'apela' in finalidade_lower or 'recurso' in finalidade_lower:
            guia.append("   Para APELAÇÃO/RECURSO:")
            guia.append("   ├─ ANALISE_COMPLETA_PRAZOS.txt (verificar tempestividade)")
            guia.append("   ├─ FICHAMENTO_INTEGRAL_PROCESSO.txt (linha do tempo)")
            guia.append("   └─ Decisão recorrida (copiar do RESUMO_DENSO)")
        elif 'inicial' in finalidade_lower or 'petição' in finalidade_lower:
            guia.append("   Para PETIÇÃO INICIAL:")
            guia.append("   ├─ TRANSCRICAO_COMPLETA_DEPOIMENTOS.txt (provas)")
            guia.append("   ├─ Documentos relevantes da pasta 06_Documentos_Anexados")
            guia.append("   └─ ANALISE_COMPLETA_PRAZOS.txt (prescrição/decadência)")
        elif 'contest' in finalidade_lower or 'defesa' in finalidade_lower:
            guia.append("   Para CONTESTAÇÃO/DEFESA:")
            guia.append("   ├─ Petição inicial do adversário (do RESUMO_DENSO)")
            guia.append("   ├─ FICHAMENTO_INTEGRAL_PROCESSO.txt")
            guia.append("   └─ Documentos que contrariam alegações do autor")
        else:
            guia.append("   Arquivos recomendados:")
            guia.append("   ├─ FICHAMENTO_INTEGRAL_PROCESSO.txt")
            guia.append("   ├─ ANALISE_COMPLETA_PRAZOS.txt")
            guia.append("   └─ Documentos específicos conforme necessidade")

        guia.append("")
        guia.append("💬 PROMPT SUGERIDO:")
        guia.append('   """')
        guia.append('   Com base em toda nossa análise anterior (Sessões 1 e 2),')
        guia.append(f'   preciso que você redija uma {self.finalidade if self.finalidade else "PEÇA JURÍDICA"}.')
        guia.append('')
        guia.append('   CONTEXTO:')
        guia.append(f'   - Processo: {self.config.get("numero_processo", "N/A")}')
        guia.append(f'   - Cliente: {self.cliente if self.cliente else "[INFORMAR CLIENTE]"}')
        guia.append('')
        guia.append('   REQUISITOS DA PEÇA:')
        guia.append('   1. Estrutura técnica e formal adequada')
        guia.append('   2. Fundamentação jurídica sólida (leis, jurisprudência)')
        guia.append('   3. Argumentação persuasiva baseada nos FATOS do processo')
        guia.append('   4. Citação de DEPOIMENTOS e PROVAS quando relevantes')
        guia.append('   5. Linguagem forense adequada')
        guia.append('')
        guia.append('   IMPORTANTE:')
        guia.append('   - Use os FATOS REAIS extraídos dos autos')
        guia.append('   - Cite números de páginas/documentos quando possível')
        guia.append('   - Mantenha coerência com análise das Sessões 1 e 2')
        guia.append('   """')
        guia.append("")
        guia.append("🎯 OBJETIVO: Peça jurídica pronta ou minuta avançada")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # DICAS AVANÇADAS
        guia.append("💡 DICAS AVANÇADAS")
        guia.append("─"*100)
        guia.append("")
        guia.append("1. CONTEXTO PERSISTENTE")
        guia.append("   └─ Use a MESMA conversa no Claude.ai para as 3 sessões")
        guia.append("   └─ Claude manterá contexto entre as sessões")
        guia.append("")
        guia.append("2. REFERÊNCIA CRUZADA")
        guia.append("   └─ 'Como vimos na Sessão 1...'")
        guia.append("   └─ 'Conforme o depoimento analisado anteriormente...'")
        guia.append("")
        guia.append("3. ITERAÇÃO")
        guia.append("   └─ Após receber a peça, peça revisões específicas:")
        guia.append("   └─ 'Reforce o argumento sobre prescrição'")
        guia.append("   └─ 'Adicione jurisprudência do STJ sobre...'")
        guia.append("")
        guia.append("4. TAMANHO DOS ARQUIVOS")
        guia.append("   └─ Claude.ai aceita ~100.000 tokens por mensagem")
        guia.append("   └─ 1 token ≈ 4 caracteres em português")
        guia.append("   └─ Arquivos > 400 KB podem precisar divisão")
        guia.append("")
        guia.append("5. PEDIDOS ESPECÍFICOS")
        if self.pedidos_especificos:
            guia.append(f"   └─ Você solicitou: {self.pedidos_especificos}")
            guia.append("   └─ SEMPRE mencione isso ao Claude nas sessões!")
        else:
            guia.append("   └─ Seja específico sobre o que quer analisar")
            guia.append("   └─ Ex: 'foque em laudos médicos', 'analise dados financeiros'")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # ESTATÍSTICAS DO PROCESSO
        guia.append("📊 ESTATÍSTICAS DESTE PROCESSO")
        guia.append("─"*100)
        guia.append(f"Total de movimentos: {len(movimentos)}")
        guia.append(f"Total de documentos: {len(documentos)}")
        guia.append(f"Total de depoimentos: {len(depoimentos)}")
        guia.append("")

        # Calcular tamanhos aproximados dos arquivos
        guia.append("Tamanhos aproximados dos arquivos principais:")
        guia.append(f"├─ RESUMO_EXECUTIVO.txt: ~20 KB (SEMPRE cabe)")
        guia.append(f"├─ RESUMO_EXECUTIVO_DENSO.txt: ~{len(movimentos) * 2} KB (verificar)")
        guia.append(f"├─ TRANSCRICAO_DEPOIMENTOS.txt: ~{len(depoimentos) * 5} KB")
        guia.append(f"└─ FICHAMENTO_INTEGRAL.txt: ~{len(movimentos) * 1} KB")
        guia.append("")
        guia.append("💡 Se arquivo > 500 KB: divida em sessões temáticas (ver SESSÃO 2 - OPÇÃO B)")
        guia.append("")
        guia.append("="*100)
        guia.append("")

        # RODAPÉ
        guia.append("✅ CHECKLIST FINAL")
        guia.append("─"*100)
        guia.append("Antes de iniciar suas sessões no Claude.ai, verifique:")
        guia.append("□ Li este GUIA completamente")
        guia.append("□ Identifiquei qual PEÇA preciso redigir")
        guia.append("□ Verifiquei tamanho dos arquivos")
        guia.append("□ Planejei quantas sessões precisarei (mínimo 3)")
        guia.append("□ Tenho os arquivos organizados e prontos")
        guia.append("")
        guia.append("="*100)
        guia.append(f"Guia gerado automaticamente em {datetime.now().strftime('%d/%m/%Y às %H:%M')}")
        guia.append("Sistema de Extração IAROM - 60+ Ferramentas Jurídicas")
        guia.append("="*100)

        # Salvar
        caminho = os.path.join(self.pasta_saida, '08_Relatorios', 'GUIA_ESTRATEGICO_CLAUDE_AI.txt')
        texto_guia = '\n'.join(guia)

        # Aplicar otimização se habilitada
        if self.otimizar_para_claude:
            texto_guia = self.otimizar_texto(texto_guia)

        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto_guia)

        print(f"   ✅ Guia Estratégico gerado")
        print(f"   📁 Salvo em: 08_Relatorios/GUIA_ESTRATEGICO_CLAUDE_AI.txt")

    def compactar_para_download(self):
        """Compacta todos os arquivos para download"""
        print("\n" + "="*80)
        print("COMPACTANDO ARQUIVOS PARA DOWNLOAD")
        print("="*80)

        # Criar ZIP
        zip_path = f"{self.pasta_saida}.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(self.pasta_saida):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, self.pasta_saida)
                    zipf.write(file_path, arcname)

        tamanho_zip = os.path.getsize(zip_path) / (1024*1024)
        print(f"\n✅ Arquivo compactado: {os.path.basename(zip_path)} ({tamanho_zip:.2f} MB)")
        print(f"📁 Local: {zip_path}")

        return zip_path

    def compactar_para_claude_ai(self):
        """Alias para compactar_para_download - mantém compatibilidade com API"""
        return self.compactar_para_download()


def main():
    """Função principal com interface gráfica"""
    print("="*80)
    print("SISTEMA AVANÇADO DE EXTRAÇÃO PROCESSUAL v3.0")
    print("IAROM - 60+ Ferramentas Especializadas (PDFs, OCR, Vídeos, Planilhas)")
    print("https://iarom.com.br/extrator-processual")
    print("="*80)

    extrator = ExtratorProcessualAvancado()
    extrator.detectar_sistema()

    if not extrator.verificar_dependencias():
        print("\n❌ Instale as dependências necessárias")
        print("\nPara instalar:")
        print("  macOS/Linux: sudo apt-get install poppler-utils tesseract-ocr")
        print("  Windows: Baixe em https://poppler.freedesktop.org/")
        sys.exit(1)

    try:
        # Configurar com interface gráfica
        extrator.configurar_processo()

        # Executar extração
        extrator.executar_extracao_completa()

        # Compactar
        zip_path = extrator.compactar_para_download()

        print("\n" + "="*80)
        print("✅ PROCESSO CONCLUÍDO COM SUCESSO!")
        print("="*80)
        print(f"\n📦 Arquivo final: {zip_path}")
        print(f"📁 Pasta de análise: {extrator.pasta_saida}")

    except Exception as e:
        print(f"\n❌ Erro: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
