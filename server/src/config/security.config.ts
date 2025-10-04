export const securityConfig = () => ({
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  request: {
    maxSize: parseInt(process.env.MAX_REQUEST_SIZE?.replace('mb', '') || '10', 10) * 1024 * 1024,
  },
  apiKey: {
    header: process.env.API_KEY_HEADER || 'x-api-key',
  },
});
