export interface AIModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'mistral' | 'groq';
    costPerToken: number;  // Credits per 1000 tokens
    maxTokens: number;
    isFree: boolean;
    description: string;
}

export const AI_MODELS: Record<string, AIModelConfig> = {
    'gpt-3.5-turbo': {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        costPerToken: 0.002,  // 0.002 credits per 1000 tokens
        maxTokens: 4096,
        isFree: false,
        description: 'Fast and efficient for most tasks'
    },
    'gpt-4': {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        costPerToken: 0.06,   // 0.06 credits per 1000 tokens
        maxTokens: 8192,
        isFree: false,
        description: 'Most capable model for complex reasoning'
    },
    'claude-3-haiku': {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        costPerToken: 0.0008,
        maxTokens: 4096,
        isFree: true,  // Free tier model
        description: 'Fast and lightweight Claude model'
    },
    'llama-3.1-8b-instant': {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 8192,
        isFree: true,
        description: 'Fast and efficient 8B parameter model'
    },
    'llama-3.1-70b-versatile': {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B Versatile',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 8192,
        isFree: true,
        description: 'High-performance 70B parameter model for complex tasks'
    },
    'llama-3.1-8b-instruct': {
        id: 'llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B Instruct',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 8192,
        isFree: true,
        description: 'Instruction-tuned 8B model for following directions'
    },
    'llama-3.1-70b-instruct': {
        id: 'llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B Instruct',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 8192,
        isFree: true,
        description: 'Instruction-tuned 70B model for complex reasoning'
    },
    'mixtral-8x7b-32768': {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 32768,
        isFree: true,
        description: 'Mixture of experts model with 8x7B parameters'
    },
    'gemma-7b-it': {
        id: 'gemma-7b-it',
        name: 'Gemma 7B IT',
        provider: 'groq',
        costPerToken: 0,
        maxTokens: 8192,
        isFree: true,
        description: 'Google\'s Gemma 7B instruction-tuned model'
    }
};

export const getModelConfig = (modelId: string): AIModelConfig | null => {
    return AI_MODELS[modelId] || null;
};

export const getFreeModels = (): AIModelConfig[] => {
    return Object.values(AI_MODELS).filter(model => model.isFree);
};

export const getPaidModels = (): AIModelConfig[] => {
    return Object.values(AI_MODELS).filter(model => !model.isFree);
};