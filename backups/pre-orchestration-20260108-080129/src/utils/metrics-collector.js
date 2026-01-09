/**
 * ROM Agent - Metrics Collector (v1 compatibility layer)
 * Re-exports v2 for backward compatibility
 */

import metricsCollector from './metrics-collector-v2.js';

export default metricsCollector;
export { metricsCollector as metricsCollectorV2 };
