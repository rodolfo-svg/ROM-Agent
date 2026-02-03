# Guia de Escala - ROM Agent no Render.com

## Configuração Atual (Produção)

### Hardware
- **Plan:** Pro (8 GB RAM)
- **Disk:** 100 GB SSD persistente
- **Scaling:** 1-3 instâncias (auto-scaling)
- **Workers:** 4 por instância

### Capacidade

#### Uploads Simultâneos
| Cenário | Capacidade | Status |
|---------|-----------|--------|
| **Usuários simultâneos** | 10-15 | ✅ Suportado |
| **Tamanho máximo por arquivo** | 1 GB | ✅ Suportado |
| **Total simultâneo** | 5-10 GB | ✅ Suportado |

#### Performance Esperada
- **Upload de 500 MB:**
  - Internet lenta (2 Mbps): ~20-30 minutos
  - Internet média (5 Mbps): ~8-13 minutos
  - Internet boa (10+ Mbps): ~4-7 minutos

- **Upload de 1 GB:**
  - Internet lenta (2 Mbps): ~40-60 minutos (próximo ao timeout)
  - Internet média (5 Mbps): ~16-25 minutos
  - Internet boa (10+ Mbps): ~8-13 minutos

### Limites Configurados

```yaml
REQUEST_TIMEOUT: 1800000 (30 minutos)
MAX_FILE_SIZE: 1000mb (1 GB)
MAX_BODY_SIZE: 1100mb
RATE_LIMIT_PER_MINUTE: 60 (4 uploads de 500 MB simultâneos)
RATE_LIMIT_PER_HOUR: 500 (~30 uploads de 500 MB/hora)
WEB_CONCURRENCY: 4 workers
```

## Cenários de Carga

### ✅ Cenário Suportado: 10 usuários × 500 MB

**Recursos Necessários:**
- RAM: ~3-4 GB (cada upload processando usa 300-400 MB)
- Disco: ~10 GB temporários (chunks + montagem + processamento)
- Workers: 4 workers × 2-3 uploads cada = 8-12 uploads simultâneos

**Resultado:** ✅ Sistema suporta tranquilamente

### ⚠️ Cenário Limite: 15 usuários × 1 GB

**Recursos Necessários:**
- RAM: ~6-7 GB (pode chegar perto do limite de 8 GB)
- Disco: ~30 GB temporários
- Workers: 4 workers × 3-4 uploads cada = 12-16 uploads

**Resultado:** ⚠️ Possível com auto-scaling (2-3 instâncias)

### ❌ Cenário Problemático: 20+ usuários simultâneos

**Recursos Necessários:**
- RAM: >8 GB
- Disco: >50 GB temporários

**Resultado:** ❌ Necessário upgrade para múltiplas instâncias Pro Plus

## Monitoramento

### Métricas Críticas
1. **RAM Usage:** Manter abaixo de 80% (6.4 GB de 8 GB)
2. **Disk Usage:** Manter abaixo de 70% (70 GB de 100 GB)
3. **Response Time:** Uploads devem completar em <25 minutos
4. **Error Rate:** Manter abaixo de 5%

### Alertas Recomendados
- RAM >85%: Considerar upgrade ou otimização
- Disk >80%: Limpar arquivos antigos ou aumentar disco
- Timeout rate >10%: Aumentar REQUEST_TIMEOUT
- Rate limit hits >5%: Ajustar RATE_LIMIT_PER_MINUTE

## Otimizações Futuras

### Se precisar suportar >15 usuários simultâneos:

1. **Implementar Queue System:**
   ```javascript
   // Bull/BullMQ para processar uploads em background
   // Evita sobrecarga de RAM com processamento simultâneo
   ```

2. **Separar Processing Worker:**
   ```yaml
   # Criar serviço separado para processamento
   - type: worker
     name: rom-agent-processor
     plan: pro
   ```

3. **Implementar Cache de Sessões:**
   ```javascript
   // Redis para armazenar sessões de upload
   // Melhor que arquivos no disco para múltiplas instâncias
   ```

4. **Adicionar CDN:**
   ```yaml
   # Cloudflare ou CloudFront na frente
   # Reduz carga no Render para assets estáticos
   ```

## Custos Estimados (Render.com)

| Componente | Custo Mensal |
|-----------|-------------|
| **Produção (Pro plan)** | ~$85/mês |
| **Disk 100 GB** | ~$30/mês ($0.30/GB) |
| **Auto-scaling (2-3 instâncias)** | Variável (~$170-$255 sob carga) |
| **PostgreSQL** | Conforme plan |
| **TOTAL BASE** | ~$115-$200/mês |
| **TOTAL PICO (3 instâncias)** | ~$340/mês |

## Troubleshooting

### Erro: "Out of Memory" (OOM)
**Causa:** Muitos uploads processando simultaneamente
**Solução:** Implementar queue ou upgrade para Pro Plus (16 GB RAM)

### Erro: "Request Timeout"
**Causa:** Upload >1 GB com internet lenta
**Solução:** Aumentar REQUEST_TIMEOUT para 3600000 (60 min) ou recomendar usuário compactar arquivo

### Erro: "Disk Full"
**Causa:** Muitos arquivos temporários não foram limpos
**Solução:** Implementar cron job para limpar /var/data/upload/temp e /chunks a cada hora

### Erro: "Rate Limit Exceeded"
**Causa:** Usuário fazendo múltiplos uploads grandes em sequência rápida
**Solução:** Aumentar RATE_LIMIT_PER_MINUTE ou implementar whitelist para IPs conhecidos

---

**Última atualização:** 2026-02-03
**Versão ROM Agent:** 4.0.9+
**Configuração testada:** 10 usuários × 500 MB simultâneos ✅
