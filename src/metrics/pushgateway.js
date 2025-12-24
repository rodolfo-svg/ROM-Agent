import client from 'prom-client';
const { Pushgateway, register } = client;

let started = false;

export function startPushgateway() {
  if (started) return;
  const url = process.env.PUSHGATEWAY_URL;
  if (!url) return;
  started = true;

  const job = process.env.METRICS_JOB || 'rom-agent-ia';
  const env = process.env.METRICS_ENV || process.env.NODE_ENV || 'unknown';
  const instance = process.env.INSTANCE_ID || process.env.HOSTNAME || `pid_${process.pid}`;
  const intervalMs = Number(process.env.PUSHGATEWAY_PUSH_INTERVAL_MS || 10000);

  const gw = new Pushgateway(url);

  const pushOnce = () => {
    gw.pushAdd({ jobName: job, groupings: { env, instance } }, (err) => {
      if (err) console.error('[pushgateway] pushAdd error:', err?.message || err);
    });
  };

  pushOnce();
  const t = setInterval(pushOnce, intervalMs);
  if (typeof t.unref === 'function') t.unref();
}
