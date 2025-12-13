#!/bin/bash

# ============================================================================
# Script: Verificar Configuração de DNS
# Uso: ./scripts/deploy/check-dns.sh agente.rom.adv.br
# ============================================================================

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para printar com cor
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Banner
echo ""
echo "============================================"
echo "  Verificador de DNS - ROM Agent"
echo "============================================"
echo ""

# Verificar se domínio foi fornecido
if [ -z "$1" ]; then
    print_error "Uso: $0 <dominio>"
    echo "Exemplo: $0 agente.rom.adv.br"
    exit 1
fi

DOMAIN=$1

# 1. Verificar se domínio existe
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Verificando existência do domínio..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if host $DOMAIN > /dev/null 2>&1; then
    print_success "Domínio existe e responde"
else
    print_error "Domínio não encontrado ou não configurado"
    print_info "Aguarde propagação DNS (2-6 horas)"
    exit 1
fi

echo ""

# 2. Verificar Nameservers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Verificando Nameservers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NS_OUTPUT=$(dig NS $DOMAIN +short)

if echo "$NS_OUTPUT" | grep -q "cloudflare"; then
    print_success "Nameservers apontam para Cloudflare"
    echo "$NS_OUTPUT" | while read ns; do
        echo "  → $ns"
    done
else
    print_warning "Nameservers NÃO são do Cloudflare"
    echo "$NS_OUTPUT" | while read ns; do
        echo "  → $ns"
    done
    print_info "Se configurou recentemente, aguarde propagação"
fi

echo ""

# 3. Verificar Tipo de Record
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Verificando tipo de DNS record..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if dig $DOMAIN CNAME +short | grep -q "."; then
    CNAME=$(dig $DOMAIN CNAME +short)
    print_success "CNAME encontrado"
    echo "  → $DOMAIN aponta para $CNAME"

    if echo "$CNAME" | grep -q "render\|railway\|vercel\|herokuapp"; then
        print_success "Aponta para plataforma de hosting reconhecida"
    fi
elif dig $DOMAIN A +short | grep -q "."; then
    A_RECORD=$(dig $DOMAIN A +short)
    print_success "A record encontrado"
    echo "  → $DOMAIN aponta para IP $A_RECORD"
else
    print_error "Nenhum record A ou CNAME encontrado"
fi

echo ""

# 4. Verificar SSL/HTTPS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Verificando SSL/HTTPS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -sI https://$DOMAIN | head -n 1 | grep -q "200\|301\|302"; then
    print_success "HTTPS funciona (site responde)"

    # Verificar certificado
    CERT_INFO=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)

    if echo "$CERT_INFO" | grep -q "."; then
        print_success "Certificado SSL válido"
        echo "$CERT_INFO" | grep "notAfter" | sed 's/notAfter=/  Expira: /'
    fi

    # Verificar se é Cloudflare
    if curl -sI https://$DOMAIN | grep -qi "cloudflare"; then
        print_success "Protegido pelo Cloudflare"
    fi
else
    print_error "HTTPS não responde ou erro no servidor"
    print_info "Verifique se servidor está online"
fi

echo ""

# 5. Verificar Redirecionamento HTTP → HTTPS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Verificando redirecionamento HTTP → HTTPS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -sI http://$DOMAIN | grep -qi "Location: https://"; then
    print_success "HTTP redireciona para HTTPS automaticamente"
else
    print_warning "HTTP não redireciona para HTTPS"
    print_info "Configure 'Always Use HTTPS' no Cloudflare"
fi

echo ""

# 6. Verificar Tempo de Resposta
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Medindo tempo de resposta..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' https://$DOMAIN)
RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

echo "  Tempo de resposta: ${RESPONSE_MS}ms"

if (( $(echo "$RESPONSE_TIME < 1" | bc -l) )); then
    print_success "Resposta rápida (< 1s)"
elif (( $(echo "$RESPONSE_TIME < 3" | bc -l) )); then
    print_warning "Resposta aceitável (< 3s)"
else
    print_error "Resposta lenta (> 3s)"
    print_info "Considere otimizações ou upgrade do servidor"
fi

echo ""

# 7. Verificar Headers de Segurança
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Verificando headers de segurança..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEADERS=$(curl -sI https://$DOMAIN)

if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    print_success "HSTS habilitado"
else
    print_warning "HSTS não encontrado"
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
    print_success "X-Frame-Options configurado"
else
    print_warning "X-Frame-Options não encontrado"
fi

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
    print_success "X-Content-Type-Options configurado"
else
    print_warning "X-Content-Type-Options não encontrado"
fi

echo ""

# 8. Verificar Propagação Global
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. Verificando propagação global..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_info "Testando resolução DNS em diferentes locais..."

# Lista de servidores DNS públicos para testar
declare -A DNS_SERVERS=(
    ["Google"]="8.8.8.8"
    ["Cloudflare"]="1.1.1.1"
    ["OpenDNS"]="208.67.222.222"
)

for name in "${!DNS_SERVERS[@]}"; do
    server="${DNS_SERVERS[$name]}"
    if dig @$server $DOMAIN +short | grep -q "."; then
        print_success "$name DNS resolve corretamente"
    else
        print_warning "$name DNS ainda não propagou"
    fi
done

echo ""

# Resumo Final
echo "============================================"
echo "  RESUMO"
echo "============================================"
echo ""

if curl -sI https://$DOMAIN | head -n 1 | grep -q "200"; then
    print_success "SITE ESTÁ ONLINE E FUNCIONANDO!"
    echo ""
    print_info "Acesse: https://$DOMAIN"
    print_info "SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
else
    print_warning "SITE NÃO ESTÁ TOTALMENTE FUNCIONAL"
    echo ""
    print_info "Possíveis causas:"
    echo "  - DNS ainda propagando (aguarde 2-6h)"
    echo "  - Servidor offline (verifique Render)"
    echo "  - Configuração incorreta do DNS"
fi

echo ""
echo "============================================"
