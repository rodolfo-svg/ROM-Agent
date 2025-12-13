# /extrair - Extração de Processo PDF

Extrai e processa texto de PDFs de processos judiciais aplicando as 33 ferramentas e 10 processadores.

## Argumentos
- `$ARGUMENTS` - Caminho do arquivo PDF

## 33 Ferramentas de Processamento

1. Normalização Unicode (NFC)
2. Remoção de caracteres de controle
3. Correção de encoding UTF-8
4. Remoção de BOM
5. Normalização de quebras de linha
6. Remoção de linhas em branco excessivas
7. Normalização de espaços
8. Correção de hifenização
9. Remoção de cabeçalhos/rodapés repetitivos
10. Remoção de numeração de páginas
11. Correção de caracteres especiais jurídicos
12. Normalização de citações legais
13. Formatação de números de processo (CNJ)
14. Formatação de CPF/CNPJ
15. Formatação de datas brasileiras
16. Formatação de valores monetários
17. Correção de OCR comum
18. Remoção de marcas d'água
19. Identificação de seções do documento
20. Extração de metadados
21. Identificação de partes processuais
22. Extração de datas relevantes
23. Identificação de decisões
24. Extração de citações jurisprudenciais
25. Identificação de artigos de lei
26. Detecção de idioma
27. Correção de acentuação
28. Normalização de siglas jurídicas
29. Identificação de valores monetários
30. Extração de prazos
31. Identificação de intimações
32. Marcação de destaques/grifos
33. Validação de integridade do texto

## 10 Processadores de Otimização

1. Extração de metadados estruturados
2. Identificação automática de documento
3. Compressão de redundâncias
4. Chunking inteligente para IA
5. Indexação de conteúdo
6. Geração de sumário automático
7. Classificação de documentos
8. Extração de entidades nomeadas
9. Análise de sentimento jurídico
10. Validação de consistência

## Saída

O processo extraído será salvo em:
- `TEXTO_COMPLETO_OTIMIZADO.txt` - Texto processado completo
- `00_METADADOS_PROCESSO.txt` - Metadados extraídos
- `PARTE_XX_de_YY.txt` - Partes divididas (se necessário)

## Estatísticas Geradas
- Tamanho original vs otimizado
- Taxa de compressão
- Páginas processadas
- Tokens estimados
