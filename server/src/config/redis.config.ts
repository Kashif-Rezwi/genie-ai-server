export const redisConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        jobsDb: parseInt(process.env.REDIS_JOBS_DB || '1', 10),
        cacheDb: parseInt(process.env.REDIS_CACHE_DB || '2', 10),
        sessionDb: parseInt(process.env.REDIS_SESSION_DB || '3', 10),

        // Connection settings
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
        commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
        lazyConnect: true,
        keepAlive: 30000,

        // Retry settings
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
        retryDelayOnClusterDown: 300,
        enableOfflineQueue: false,

        // Pool settings
        family: 4, // IPv4
        enableReadyCheck: true,
        maxLoadingTimeout: parseInt(process.env.REDIS_MAX_LOADING_TIMEOUT || '5000', 10),

        // Performance settings
        enableAutoPipelining: true,
        maxAutoPipeliningSize: parseInt(process.env.REDIS_MAX_PIPELINE_SIZE || '100', 10),

        // Memory optimization
        stringNumbers: true,
        dropBufferSupport: true,

        // Security settings
        tls: isProduction
            ? {
                  rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
              }
            : undefined,

        // Monitoring
        enableMonitor: process.env.REDIS_ENABLE_MONITOR === 'true',

        // Cluster settings (if using Redis Cluster)
        enableCluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
        clusterRetryDelayOnFailover: 100,
        clusterRetryDelayOnClusterDown: 300,
        clusterMaxRedirections: 16,

        // Sentinel settings (if using Redis Sentinel)
        sentinels: process.env.REDIS_SENTINELS
            ? process.env.REDIS_SENTINELS.split(',').map(s => {
                  const [host, port] = s.trim().split(':');
                  return { host, port: parseInt(port, 10) };
              })
            : undefined,
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster',

        // Key prefix for namespacing
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'genie:',

        // Compression settings
        compression: process.env.REDIS_COMPRESSION === 'true' ? 'gzip' : undefined,

        // Logging
        logErrors: true,
        logWarnings: process.env.NODE_ENV === 'development',
    };
};
