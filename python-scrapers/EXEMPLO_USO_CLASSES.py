#!/usr/bin/env python3
"""
Exemplos de Uso das Classes Utils - SCEAP v4.0
Demonstra como usar as 7 classes criadas
"""

from pathlib import Path
from datetime import date

# Adicionar ao path
import sys
sys.path.insert(0, str(Path(__file__).parent / "sceap" / "utils"))

print("="*70)
print("EXEMPLOS DE USO DAS CLASSES UTILS - SCEAP v4.0")
print("="*70)

# ==============================================================================
# 1. FileDetector - Detectar tipo de arquivo
# ==============================================================================
print("\n1. FileDetector - Detectar tipo de arquivo")
print("-"*70)

from file_detector import FileDetector

detector = FileDetector()
# detector.detectar(Path("documento.pdf"))

print(f"FileDetector criado: {detector}")
print(f"MIME types suportados: {len(detector.SUPPORTED_TYPES)}")


# ==============================================================================
# 2. GerenciadorFeriados - Feriados brasileiros
# ==============================================================================
print("\n2. GerenciadorFeriados - Feriados brasileiros")
print("-"*70)

from feriados_class import GerenciadorFeriados

# Criar para Goiás
ger = GerenciadorFeriados("GO", "GOIANIA")

# Calcular Páscoa 2024
pascoa_2024 = ger.calcular_pascoa(2024)
print(f"Páscoa 2024: {pascoa_2024}")

# Verificar se é feriado
natal_2024 = date(2024, 12, 25)
print(f"25/12/2024 é feriado? {ger.eh_feriado(natal_2024)}")
print(f"Nome: {ger.obter_nome_feriado(natal_2024)}")

# Verificar dia útil
dia_util = date(2024, 1, 2)
print(f"02/01/2024 é dia útil? {ger.eh_dia_util(dia_util)}")

# Listar todos os feriados de 2024
feriados_2024 = ger.listar_feriados_ano(2024)
print(f"Total de feriados em 2024: {len(feriados_2024)}")


# ==============================================================================
# 3. CalculadorPrazos - Prazos processuais
# ==============================================================================
print("\n3. CalculadorPrazos - Prazos processuais")
print("-"*70)

from prazos_class import CalculadorPrazos

calc = CalculadorPrazos("GOIANIA", "GO")

# Adicionar feriados
feriados = ger.obter_feriados_nacionais(2024)
calc.adicionar_feriados(feriados)

# Calcular prazo de 15 dias úteis
data_inicial = date(2024, 1, 2)
prazo_uteis = calc.calcular_prazo(data_inicial, 15, "UTEIS")
print(f"15 dias úteis de {data_inicial}: {prazo_uteis}")

# Calcular prazo de 30 dias corridos
prazo_corridos = calc.calcular_prazo(data_inicial, 30, "CORRIDOS")
print(f"30 dias corridos de {data_inicial}: {prazo_corridos}")

# Verificar tempestividade
resultado = calc.verificar_tempestividade(
    data_intimacao=date(2024, 1, 2),
    data_protocolo=date(2024, 1, 20),
    prazo_dias=15,
    tipo="UTEIS"
)
print(f"Tempestivo? {resultado['tempestivo']}")
print(f"Data limite: {resultado['data_limite']}")


# ==============================================================================
# 4. CNJParser - Parser de números CNJ
# ==============================================================================
print("\n4. CNJParser - Parser de números CNJ")
print("-"*70)

from cnj_parser_class import CNJParser

parser = CNJParser()

numero_cnj = "0124496-18.2018.8.09.0011"

# Validar
valido = parser.validar(numero_cnj)
print(f"Número válido? {valido}")

# Parse
info = parser.parse(numero_cnj)
if info:
    print(f"Ano ajuizamento: {info['ano_ajuizamento']}")
    print(f"Tribunal: {info['tribunal_nome']}")
    print(f"Justiça: {info['justica_nome']}")


# ==============================================================================
# 5. ValidadorCPFCNPJ - Validação de documentos
# ==============================================================================
print("\n5. ValidadorCPFCNPJ - Validação de documentos")
print("-"*70)

from cpf_cnpj_class import ValidadorCPFCNPJ

validador = ValidadorCPFCNPJ()

# Validar CPF
cpf = "123.456.789-09"
cpf_valido = validador.validar_cpf(cpf)
print(f"CPF {cpf} válido? {cpf_valido}")

# Formatar CPF
cpf_formatado = validador.formatar_cpf("12345678909")
print(f"CPF formatado: {cpf_formatado}")

# Validar CNPJ
cnpj = "11.222.333/0001-81"
cnpj_valido = validador.validar_cnpj(cnpj)
print(f"CNPJ {cnpj} válido? {cnpj_valido}")


# ==============================================================================
# 6. GeradorChecksum - SHA-256
# ==============================================================================
print("\n6. GeradorChecksum - SHA-256")
print("-"*70)

from checksum_class import GeradorChecksum

gerador = GeradorChecksum()

# Calcular SHA-256 de arquivo
# checksum = gerador.calcular_sha256(Path("arquivo.pdf"))
# print(f"SHA-256: {checksum}")

# Verificar integridade
# integro = gerador.verificar_integridade(
#     Path("arquivo.pdf"),
#     "abc123...esperado"
# )
# print(f"Arquivo íntegro? {integro}")

print("GeradorChecksum criado")
print("Use: gerador.calcular_sha256(arquivo)")


# ==============================================================================
# 7. DetectorEncoding - Detecção de encoding
# ==============================================================================
print("\n7. DetectorEncoding - Detecção de encoding")
print("-"*70)

from encoding_class import DetectorEncoding

detector_enc = DetectorEncoding()

# Detectar encoding
# info = detector_enc.detectar(Path("arquivo.txt"))
# print(f"Encoding: {info['encoding']}")
# print(f"Confiança: {info['confianca']}")

# Converter para UTF-8
# conteudo = detector_enc.converter_para_utf8(Path("arquivo.txt"))
# print(conteudo)

print("DetectorEncoding criado")
print(f"Chardet disponível? {detector_enc.chardet_available}")
print("Use: detector_enc.detectar(arquivo)")

print("\n" + "="*70)
print("Todos os exemplos executados com sucesso!")
print("="*70)
