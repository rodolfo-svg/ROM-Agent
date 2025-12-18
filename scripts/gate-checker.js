#!/usr/bin/env node
/**
 * Gate Checker (sem Prometheus externo)
 * - Calcula P95 por histogram buckets
 * - Roda em staging.iarom.com.br (ou env STAGING_URL)
 * - Exit 0 se passar gates por janela inteira; Exit 1 se falhar
 */

const STAGING_URL = process.env.STAGING_URL || "https://staging.iarom.com.br";
const INTERVAL_MS = parseInt(process.env.GATE_INTERVAL_MS || String(5 * 60 * 1000), 10); // 5 min
const WINDOW_MS = parseInt(process.env.GATE_WINDOW_MS || String(2 * 60 * 60 * 1000), 10); // 2h
const TARGET_PATH = process.env.GATE_PATH || "/api/chat";

// Gates (ajuste por env se quiser)
const LIMITS = {
  errorRate: parseFloat(process.env.GATE_ERROR_RATE || "0.001"),          // <0.1%
  latencyP95: parseFloat(process.env.GATE_LATENCY_P95 || "30"),            // <30s
  ramPercent: parseFloat(process.env.GATE_RAM_PCT || "0.70"),              // <70%
  costPerReq: parseFloat(process.env.GATE_COST_PER_REQ || "0.50"),         // <$0.50
  throttleRate: parseFloat(process.env.GATE_429_RATE || "0.005"),          // <0.5%
  guardrailsFalsePos: parseFloat(process.env.GATE_FALSE_POS || "0.01"),    // <1%
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchMetrics() {
  const res = await fetch(`${STAGING_URL}/metrics`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`Falha ao buscar /metrics: ${res.status}`);
  return await res.text();
}

/**
 * Parse simples do formato Prometheus exposition:
 * metric_name{label="x",...} value
 */
function parseProm(text) {
  const lines = text.split("\n");
  const samples = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    // exemplo: name{a="b",c="d"} 123
    // ou: name 123
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{.*\})?\s+([0-9eE+.\-]+)$/);
    if (!m) continue;
    const name = m[1];
    const labelStr = m[2] || "";
    const value = Number(m[3]);
    const labels = {};
    if (labelStr) {
      const inner = labelStr.slice(1, -1); // remove { }
      // split por vírgula respeitando aspas simples (bom o suficiente pro nosso caso)
      const parts = inner.length ? inner.match(/(?:[^,"\\]|\\.|"[^"]*")+/g) : [];
      if (parts) {
        for (const p of parts) {
          const kv = p.split("=");
          if (kv.length !== 2) continue;
          const k = kv[0].trim();
          let v = kv[1].trim();
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          labels[k] = v;
        }
      }
    }
    samples.push({ name, labels, value });
  }
  return samples;
}

function sumMetric(samples, metricName, filterLabels = {}) {
  return samples
    .filter((s) => s.name === metricName)
    .filter((s) => {
      for (const [k, v] of Object.entries(filterLabels)) {
        if (s.labels[k] !== v) return false;
      }
      return true;
    })
    .reduce((acc, s) => acc + s.value, 0);
}

function getHistogramBuckets(samples, baseName, filterLabels = {}) {
  // baseName_bucket{le="..."} count (cumulativo)
  const buckets = samples
    .filter((s) => s.name === `${baseName}_bucket`)
    .filter((s) => {
      for (const [k, v] of Object.entries(filterLabels)) {
        if (s.labels[k] !== v) return false;
      }
      return true;
    })
    .map((s) => ({
      le: s.labels.le,
      count: s.value,
    }));

  // ordenar por le (numeric; +Inf por último)
  buckets.sort((a, b) => {
    const av = a.le === "+Inf" ? Infinity : Number(a.le);
    const bv = b.le === "+Inf" ? Infinity : Number(b.le);
    return av - bv;
  });

  return buckets;
}

function quantileFromBuckets(buckets, q) {
  if (!buckets.length) return null;
  const total = buckets[buckets.length - 1].count; // +Inf
  if (!isFinite(total) || total <= 0) return null;

  const rank = q * total;
  for (const b of buckets) {
    if (b.count >= rank) {
      const le = b.le === "+Inf" ? Infinity : Number(b.le);
      return le;
    }
  }
  return null;
}

function checkGates(metrics) {
  const gates = {
    errorRate: metrics.errorRate < LIMITS.errorRate,
    latencyP95: metrics.latencyP95 < LIMITS.latencyP95,
    ram: metrics.ramPercent < LIMITS.ramPercent,
    cost: metrics.costPerRequest < LIMITS.costPerReq,
    throttle: metrics.throttleRate < LIMITS.throttleRate,
    guardrails: metrics.guardrailsFalsePositive < LIMITS.guardrailsFalsePos,
  };
  const allPassed = Object.values(gates).every(Boolean);
  return { gates, allPassed };
}

function pct(x) {
  return (x * 100).toFixed(3) + "%";
}

async function main() {
  console.log("🔍 Gate Checker (P95 via buckets) iniciado");
  console.log(`URL: ${STAGING_URL}`);
  console.log(`Path alvo: ${TARGET_PATH}`);
  console.log(`Intervalo: ${INTERVAL_MS / 1000}s | Janela: ${Math.round(WINDOW_MS / 60000)}min`);
  console.log("");

  const start = Date.now();
  const results = [];

  while (true) {
    const text = await fetchMetrics();
    const samples = parseProm(text);

    // HTTP totals
    const httpTotalAll = sumMetric(samples, "http_requests_total", {});
    const http5xxAll =
      sumMetric(samples, "http_requests_total", { status: "500" }) +
      sumMetric(samples, "http_requests_total", { status: "501" }) +
      sumMetric(samples, "http_requests_total", { status: "502" }) +
      sumMetric(samples, "http_requests_total", { status: "503" }) +
      sumMetric(samples, "http_requests_total", { status: "504" }) +
      sumMetric(samples, "http_requests_total", { status: "505" });

    const errorRate = httpTotalAll > 0 ? http5xxAll / httpTotalAll : 0;

    // P95 por buckets do path /api/chat (se não tiver label path, tenta global)
    let buckets = getHistogramBuckets(samples, "http_request_duration_seconds", { path: TARGET_PATH });
    if (!buckets.length) buckets = getHistogramBuckets(samples, "http_request_duration_seconds", {});
    const latencyP95 = quantileFromBuckets(buckets, 0.95) ?? Infinity;

    // RAM: default metrics do prom-client
    const heapUsed = sumMetric(samples, "nodejs_heap_size_used_bytes", {});
    const heapTotal = sumMetric(samples, "nodejs_heap_size_total_bytes", {});
    const ramPercent = heapTotal > 0 ? heapUsed / heapTotal : 0;

    // Bedrock cost/req
    const bedrockReq = sumMetric(samples, "bedrock_requests_total", {});
    const bedrockCost = sumMetric(samples, "bedrock_cost_usd_total", {});
    const costPerRequest = bedrockReq > 0 ? bedrockCost / bedrockReq : 0;

    // 429 rate (proxy)
    const throttles = sumMetric(samples, "bedrock_errors_total", { error_type: "ThrottlingException" });
    const throttleRate = bedrockReq > 0 ? throttles / bedrockReq : 0;

    // Guardrails false positives (proxy)
    const softHits = sumMetric(samples, "guardrails_triggered_total", { reason: "soft_limit" });
    const httpChatTotal = sumMetric(samples, "http_requests_total", { path: TARGET_PATH }) || httpTotalAll || 1;
    const guardrailsFalsePositive = softHits / httpChatTotal;

    const metrics = {
      errorRate,
      latencyP95,
      ramPercent,
      costPerRequest,
      throttleRate,
      guardrailsFalsePositive,
      httpTotalAll,
      bedrockReq,
    };

    const { gates, allPassed } = checkGates(metrics);
    const now = new Date().toISOString();

    results.push({ ts: Date.now(), metrics, gates, allPassed });

    console.log(`[${now}]`);
    console.log(`  • error_rate: ${pct(metrics.errorRate)} ${gates.errorRate ? "✅" : "❌"}`);
    console.log(`  • latency_p95: ${Number.isFinite(metrics.latencyP95) ? metrics.latencyP95.toFixed(2) + "s" : "Inf"} ${gates.latencyP95 ? "✅" : "❌"}`);
    console.log(`  • ram: ${(metrics.ramPercent * 100).toFixed(2)}% ${gates.ram ? "✅" : "❌"}`);
    console.log(`  • cost/req: ${metrics.costPerRequest.toFixed(3)} ${gates.cost ? "✅" : "❌"}`);
    console.log(`  • 429_rate: ${pct(metrics.throttleRate)} ${gates.throttle ? "✅" : "❌"}`);
    console.log(`  • guardrails_fp(proxy): ${pct(metrics.guardrailsFalsePositive)} ${gates.guardrails ? "✅" : "❌"}`);
    console.log("");

    const elapsed = Date.now() - start;
    if (elapsed >= WINDOW_MS) {
      const windowStart = Date.now() - WINDOW_MS;
      const windowResults = results.filter((r) => r.ts >= windowStart);

      const passedWholeWindow = windowResults.length > 0 && windowResults.every((r) => r.allPassed);

      if (passedWholeWindow) {
        console.log("✅ ====================================");
        console.log("✅ TODOS OS GATES PASSARAM NA JANELA");
        console.log("✅ PODE AVANÇAR PARA PRÓXIMA FASE");
        console.log("✅ ====================================");
        process.exit(0);
      } else {
        console.log("❌ ====================================");
        console.log("❌ ALGUNS GATES FALHARAM NA JANELA");
        console.log("❌ NÃO PODE AVANÇAR");
        console.log("❌ ====================================");
        process.exit(1);
      }
    }

    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("❌ Gate Checker erro:", err);
  process.exit(1);
});
