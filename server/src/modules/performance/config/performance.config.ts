export interface PerformanceThresholds {
  database: {
    slowQueryThreshold: number; // milliseconds
    maxSlowQueries: number;
    minCacheHitRate: number; // 0-1
  };
  memory: {
    usageThreshold: number; // 0-1 (percentage)
    gcCountThreshold: number;
    externalMemoryThreshold: number; // bytes
  };
  redis: {
    fragmentationThreshold: number; // ratio
    latencyThreshold: number; // milliseconds
    hitRateThreshold: number; // 0-1
    maxSlowOperations: number;
  };
  cache: {
    hitRateThreshold: number; // 0-1
    latencyThreshold: number; // milliseconds
    maxKeysThreshold: number;
  };
  overall: {
    criticalScore: number; // 0-100
    warningScore: number; // 0-100
  };
}

export const performanceConfig = (): PerformanceThresholds => ({
  database: {
    slowQueryThreshold: parseInt(process.env.PERF_DB_SLOW_QUERY_THRESHOLD || '1000', 10),
    maxSlowQueries: parseInt(process.env.PERF_DB_MAX_SLOW_QUERIES || '10', 10),
    minCacheHitRate: parseFloat(process.env.PERF_DB_MIN_CACHE_HIT_RATE || '0.8'),
  },
  memory: {
    usageThreshold: parseFloat(process.env.PERF_MEMORY_USAGE_THRESHOLD || '0.8'),
    gcCountThreshold: parseInt(process.env.PERF_MEMORY_GC_COUNT_THRESHOLD || '100', 10),
    externalMemoryThreshold: parseInt(process.env.PERF_MEMORY_EXTERNAL_THRESHOLD || '104857600', 10), // 100MB
  },
  redis: {
    fragmentationThreshold: parseFloat(process.env.PERF_REDIS_FRAGMENTATION_THRESHOLD || '1.5'),
    latencyThreshold: parseInt(process.env.PERF_REDIS_LATENCY_THRESHOLD || '10', 10),
    hitRateThreshold: parseFloat(process.env.PERF_REDIS_HIT_RATE_THRESHOLD || '0.8'),
    maxSlowOperations: parseInt(process.env.PERF_REDIS_MAX_SLOW_OPS || '100', 10),
  },
  cache: {
    hitRateThreshold: parseFloat(process.env.PERF_CACHE_HIT_RATE_THRESHOLD || '0.8'),
    latencyThreshold: parseInt(process.env.PERF_CACHE_LATENCY_THRESHOLD || '5', 10),
    maxKeysThreshold: parseInt(process.env.PERF_CACHE_MAX_KEYS_THRESHOLD || '10000', 10),
  },
  overall: {
    criticalScore: parseInt(process.env.PERF_OVERALL_CRITICAL_SCORE || '60', 10),
    warningScore: parseInt(process.env.PERF_OVERALL_WARNING_SCORE || '75', 10),
  },
});
