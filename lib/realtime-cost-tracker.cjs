/**
 * ROM Agent - Real-Time Cost Tracker
 *
 * Rastreamento em tempo real de custos:
 * - AWS Bedrock (Claude API)
 * - Render.com (Hosting, Bandwidth)
 * - GitHub (Actions, Storage, LFS)
 * - IOF (6.38% em operações internacionais)
 * - Taxas de operadora de cartão
 * - Conversão PTAX (Banco Central)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class RealtimeCostTracker {
  constructor() {
    this.costsFile = path.join(process.cwd(), 'data', 'realtime-costs.json');
    this.configFile = path.join(process.cwd(), 'config', 'cost-tracking-config.json');

    // Taxa IOF para operações internacionais (Brasil)
    this.IOF_RATE = 0.0638; // 6.38%

    // Taxa de markup padrão
    this.MARKUP_RATE = 0.30; // 30%

    // Taxa de operadora de cartão (média brasileira)
    this.CARD_FEE_RATE = 0.0349; // 3.49% (média Stripe/PagSeguro)

    // AWS Bedrock Pricing (por 1M tokens)
    this.AWS_BEDROCK_PRICING = {
      'claude-haiku-4': {
        input: 0.00025,   // $0.25 per 1M input tokens
        output: 0.00125   // $1.25 per 1M output tokens
      },
      'claude-sonnet-4.5': {
        input: 0.003,     // $3 per 1M input tokens
        output: 0.015     // $15 per 1M output tokens
      },
      'claude-sonnet-4': {
        input: 0.003,     // $3 per 1M input tokens
        output: 0.015     // $15 per 1M output tokens
      },
      'claude-opus-4': {
        input: 0.015,     // $15 per 1M input tokens
        output: 0.075     // $75 per 1M output tokens
      }
    };

    // Cache de taxas de câmbio (atualiza a cada hora)
    this.exchangeRateCache = {
      rate: 5.0, // Default fallback
      timestamp: null,
      expiresIn: 60 * 60 * 1000 // 1 hora
    };

    console.log('✅ Real-Time Cost Tracker inicializado');
  }

  // ================================================================
  // AWS COST EXPLORER API - CUSTOS REAIS
  // ================================================================

  async fetchAWSBedrockCosts(startDate, endDate) {
    console.log('📊 Buscando custos AWS Bedrock...');

    try {
      // Em produção, usar AWS SDK para Cost Explorer API
      // Exemplo: aws-sdk v3
      // const { CostExplorerClient, GetCostAndUsageCommand } = require("@aws-sdk/client-cost-explorer");

      // Por enquanto, calcular baseado em logs de uso real
      const usageLogs = this.loadUsageLogs(startDate, endDate);

      let totalCost = 0;
      const breakdown = {};

      for (const log of usageLogs) {
        const model = log.model;
        const pricing = this.AWS_BEDROCK_PRICING[model];

        if (!pricing) {
          console.warn(`⚠️ Modelo desconhecido: ${model}`);
          continue;
        }

        // Calcular custo por tokens
        const inputCost = (log.inputTokens / 1000000) * pricing.input;
        const outputCost = (log.outputTokens / 1000000) * pricing.output;
        const requestCost = inputCost + outputCost;

        totalCost += requestCost;

        if (!breakdown[model]) {
          breakdown[model] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0
          };
        }

        breakdown[model].requests += 1;
        breakdown[model].inputTokens += log.inputTokens;
        breakdown[model].outputTokens += log.outputTokens;
        breakdown[model].cost += requestCost;
      }

      return {
        service: 'AWS Bedrock',
        totalCost: totalCost,
        currency: 'USD',
        breakdown: breakdown,
        period: { start: startDate, end: endDate },
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar custos AWS:', error);
      return {
        service: 'AWS Bedrock',
        totalCost: 0,
        currency: 'USD',
        breakdown: {},
        error: error.message
      };
    }
  }

  // ================================================================
  // RENDER.COM API - CUSTOS REAIS
  // ================================================================

  async fetchRenderCosts(startDate, endDate) {
    console.log('📊 Buscando custos Render.com...');

    try {
      // Render API: https://api.render.com/v1
      // Requer API Key em headers: Authorization: Bearer YOUR_API_KEY

      const config = this.loadConfig();
      const renderApiKey = config.renderApiKey || process.env.RENDER_API_KEY;

      if (!renderApiKey) {
        console.warn('⚠️ RENDER_API_KEY não configurada, usando estimativa');
        return this.estimateRenderCosts();
      }

      // Buscar serviços ativos
      const services = await this.makeRenderAPIRequest('/services', renderApiKey);

      let totalCost = 0;
      const breakdown = {
        webServices: [],
        databases: [],
        staticSites: []
      };

      for (const service of services) {
        // Custos baseados no plano
        const planCost = this.getRenderPlanCost(service.plan);
        totalCost += planCost;

        const serviceInfo = {
          name: service.name,
          type: service.type,
          plan: service.plan,
          cost: planCost,
          region: service.region
        };

        if (service.type === 'web_service') {
          breakdown.webServices.push(serviceInfo);
        } else if (service.type === 'postgres') {
          breakdown.databases.push(serviceInfo);
        } else if (service.type === 'static_site') {
          breakdown.staticSites.push(serviceInfo);
        }
      }

      // Adicionar custos de bandwidth (se disponível)
      const bandwidth = await this.getRenderBandwidthUsage(renderApiKey, startDate, endDate);
      breakdown.bandwidth = bandwidth;
      totalCost += bandwidth.cost;

      return {
        service: 'Render.com',
        totalCost: totalCost,
        currency: 'USD',
        breakdown: breakdown,
        period: { start: startDate, end: endDate },
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar custos Render:', error);
      return this.estimateRenderCosts();
    }
  }

  getRenderPlanCost(plan) {
    const pricing = {
      'free': 0,
      'starter': 7,
      'standard': 25,
      'pro': 85,
      'custom': 200
    };
    return pricing[plan] || 7;
  }

  async getRenderBandwidthUsage(apiKey, startDate, endDate) {
    // Render cobra $0.10 por GB após 100GB/mês no plano gratuito
    return {
      usage: '0 GB',
      included: '100 GB',
      overage: '0 GB',
      cost: 0
    };
  }

  estimateRenderCosts() {
    return {
      service: 'Render.com',
      totalCost: 7.00, // Plano Starter estimado
      currency: 'USD',
      breakdown: {
        webServices: [{ name: 'rom-agent-api', plan: 'starter', cost: 7 }],
        bandwidth: { usage: '~50 GB', cost: 0 }
      },
      estimated: true,
      lastUpdate: new Date().toISOString()
    };
  }

  // ================================================================
  // GITHUB API - CUSTOS REAIS
  // ================================================================

  async fetchGitHubCosts(startDate, endDate) {
    console.log('📊 Buscando custos GitHub...');

    try {
      // GitHub API v3: https://api.github.com
      const config = this.loadConfig();
      const githubToken = config.githubToken || process.env.GITHUB_TOKEN;

      if (!githubToken) {
        console.warn('⚠️ GITHUB_TOKEN não configurado, usando estimativa');
        return this.estimateGitHubCosts();
      }

      const breakdown = {
        actions: await this.getGitHubActionsCosts(githubToken),
        storage: await this.getGitHubStorageCosts(githubToken),
        lfs: await this.getGitHubLFSCosts(githubToken)
      };

      const totalCost = breakdown.actions.cost + breakdown.storage.cost + breakdown.lfs.cost;

      return {
        service: 'GitHub',
        totalCost: totalCost,
        currency: 'USD',
        breakdown: breakdown,
        period: { start: startDate, end: endDate },
        lastUpdate: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar custos GitHub:', error);
      return this.estimateGitHubCosts();
    }
  }

  async getGitHubActionsCosts(token) {
    // GitHub Actions: $0.008 por minuto (Linux)
    // Plano Free: 2000 minutos/mês
    try {
      const response = await this.makeGitHubAPIRequest(
        '/repos/rodolfootaviopereiradamotaoliveira/ROM-Agent/actions/runs',
        token
      );

      let totalMinutes = 0;
      for (const run of response.workflow_runs || []) {
        // Calcular minutos de execução
        const duration = run.run_duration_ms || 0;
        totalMinutes += duration / 60000;
      }

      const freeMinutes = 2000;
      const billableMinutes = Math.max(0, totalMinutes - freeMinutes);
      const cost = billableMinutes * 0.008;

      return {
        totalMinutes: Math.round(totalMinutes),
        freeMinutes: freeMinutes,
        billableMinutes: Math.round(billableMinutes),
        cost: cost
      };
    } catch (error) {
      console.error('Erro ao buscar GitHub Actions:', error);
      return { totalMinutes: 0, cost: 0 };
    }
  }

  async getGitHubStorageCosts(token) {
    // GitHub Storage: $0.25 por GB/mês
    // Plano Free: 500 MB
    return {
      usage: '0.2 GB',
      included: '0.5 GB',
      cost: 0
    };
  }

  async getGitHubLFSCosts(token) {
    // GitHub LFS: $5 por 50 GB
    return {
      usage: '0 GB',
      cost: 0
    };
  }

  estimateGitHubCosts() {
    return {
      service: 'GitHub',
      totalCost: 0, // Dentro do plano gratuito
      currency: 'USD',
      breakdown: {
        actions: { totalMinutes: 500, freeMinutes: 2000, cost: 0 },
        storage: { usage: '0.2 GB', included: '0.5 GB', cost: 0 },
        lfs: { usage: '0 GB', cost: 0 }
      },
      estimated: true,
      lastUpdate: new Date().toISOString()
    };
  }

  // ================================================================
  // PTAX - TAXA DE CÂMBIO (BANCO CENTRAL DO BRASIL)
  // ================================================================

  async fetchPTAXRate() {
    console.log('💱 Buscando taxa PTAX...');

    // Verificar cache
    const now = Date.now();
    if (this.exchangeRateCache.timestamp &&
        (now - this.exchangeRateCache.timestamp) < this.exchangeRateCache.expiresIn) {
      console.log('✅ Usando taxa PTAX do cache:', this.exchangeRateCache.rate);
      return this.exchangeRateCache.rate;
    }

    try {
      // API do Banco Central: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${today.slice(0,4)}-${today.slice(4,6)}-${today.slice(6,8)}'&$format=json`;

      const data = await this.makeHTTPSRequest(url);

      if (data.value && data.value.length > 0) {
        const rate = data.value[0].cotacaoCompra; // Taxa de compra

        // Atualizar cache
        this.exchangeRateCache = {
          rate: rate,
          timestamp: now,
          expiresIn: 60 * 60 * 1000 // 1 hora
        };

        console.log('✅ Taxa PTAX atualizada:', rate);
        return rate;
      }

      console.warn('⚠️ Não foi possível obter taxa PTAX, usando fallback');
      return this.exchangeRateCache.rate; // Fallback

    } catch (error) {
      console.error('❌ Erro ao buscar PTAX:', error);
      return this.exchangeRateCache.rate; // Fallback
    }
  }

  // ================================================================
  // CÁLCULO DE CUSTOS TOTAIS COM IOF E MARKUP
  // ================================================================

  async calculateTotalCosts(startDate, endDate) {
    console.log('💰 Calculando custos totais com IOF e markup...');

    // Buscar custos de todas as fontes
    const [awsCosts, renderCosts, githubCosts, ptaxRate] = await Promise.all([
      this.fetchAWSBedrockCosts(startDate, endDate),
      this.fetchRenderCosts(startDate, endDate),
      this.fetchGitHubCosts(startDate, endDate),
      this.fetchPTAXRate()
    ]);

    // Somar custos em USD
    const totalCostsUSD = awsCosts.totalCost + renderCosts.totalCost + githubCosts.totalCost;

    // Aplicar markup (30%)
    const costWithMarkup = totalCostsUSD * (1 + this.MARKUP_RATE);

    // Aplicar IOF (6.38% em operações internacionais)
    const iofAmount = costWithMarkup * this.IOF_RATE;
    const costWithIOF = costWithMarkup + iofAmount;

    // Aplicar taxa de operadora de cartão (3.49%)
    const cardFeeAmount = costWithIOF * this.CARD_FEE_RATE;
    const finalCostUSD = costWithIOF + cardFeeAmount;

    // Converter para BRL
    const finalCostBRL = finalCostUSD * ptaxRate;

    return {
      period: { start: startDate, end: endDate },
      breakdown: {
        aws: awsCosts,
        render: renderCosts,
        github: githubCosts
      },
      summary: {
        totalRealCostsUSD: totalCostsUSD.toFixed(2),
        markupRate: `${(this.MARKUP_RATE * 100).toFixed(0)}%`,
        markupAmount: (totalCostsUSD * this.MARKUP_RATE).toFixed(2),
        subtotalWithMarkup: costWithMarkup.toFixed(2),
        iofRate: `${(this.IOF_RATE * 100).toFixed(2)}%`,
        iofAmount: iofAmount.toFixed(2),
        subtotalWithIOF: costWithIOF.toFixed(2),
        cardFeeRate: `${(this.CARD_FEE_RATE * 100).toFixed(2)}%`,
        cardFeeAmount: cardFeeAmount.toFixed(2),
        finalCostUSD: finalCostUSD.toFixed(2),
        exchangeRate: ptaxRate.toFixed(4),
        finalCostBRL: finalCostBRL.toFixed(2)
      },
      timestamp: new Date().toISOString()
    };
  }

  // ================================================================
  // FORECAST - PROJEÇÃO MENSAL
  // ================================================================

  async calculateMonthlyForecast() {
    console.log('📈 Calculando projeção mensal...');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = now.toISOString();

    // Pegar custos do mês até agora
    const currentCosts = await this.calculateTotalCosts(startOfMonth, today);

    // Calcular dias decorridos no mês
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Projetar para o mês todo
    const projectionMultiplier = daysInMonth / daysElapsed;

    const projectedCostUSD = parseFloat(currentCosts.summary.finalCostUSD) * projectionMultiplier;
    const projectedCostBRL = parseFloat(currentCosts.summary.finalCostBRL) * projectionMultiplier;

    return {
      currentMonth: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        daysElapsed: daysElapsed,
        daysInMonth: daysInMonth
      },
      currentCosts: {
        usd: currentCosts.summary.finalCostUSD,
        brl: currentCosts.summary.finalCostBRL
      },
      projectedCosts: {
        usd: projectedCostUSD.toFixed(2),
        brl: projectedCostBRL.toFixed(2)
      },
      breakdown: currentCosts.breakdown,
      timestamp: new Date().toISOString()
    };
  }

  // ================================================================
  // UTILIDADES
  // ================================================================

  loadUsageLogs(startDate, endDate) {
    try {
      const logsFile = path.join(process.cwd(), 'data', 'usage-logs.json');
      if (!fs.existsSync(logsFile)) return [];

      const logs = JSON.parse(fs.readFileSync(logsFile, 'utf8'));

      // Filtrar por data
      return logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= new Date(startDate) && logDate <= new Date(endDate);
      });
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      return [];
    }
  }

  loadConfig() {
    try {
      if (!fs.existsSync(this.configFile)) {
        return {};
      }
      return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar config:', error);
      return {};
    }
  }

  saveCosts(costs) {
    try {
      const dir = path.dirname(this.costsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.costsFile, JSON.stringify(costs, null, 2));
    } catch (error) {
      console.error('Erro ao salvar custos:', error);
    }
  }

  async makeRenderAPIRequest(endpoint, apiKey) {
    const url = `https://api.render.com/v1${endpoint}`;
    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    return this.makeHTTPSRequest(url, options);
  }

  async makeGitHubAPIRequest(endpoint, token) {
    const url = `https://api.github.com${endpoint}`;
    const options = {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ROM-Agent-Cost-Tracker'
      }
    };
    return this.makeHTTPSRequest(url, options);
  }

  makeHTTPSRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      }).on('error', reject);
    });
  }
}

module.exports = RealtimeCostTracker;
