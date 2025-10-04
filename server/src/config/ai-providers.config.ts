export const aiProvidersConfig = () => ({
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
  },
  defaultModel: process.env.DEFAULT_AI_MODEL || 'llama-3.1-8b-instant',
});
