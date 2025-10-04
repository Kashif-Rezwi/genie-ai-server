export interface TransactionMetadata {
  // AI Usage metadata
  model?: string;
  provider?: 'openai' | 'anthropic' | 'groq';
  operation?: 'generate' | 'stream' | 'embedding';
  requestId?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };

  // Session tracking
  sessionId?: string;
  chatId?: string;
  messageId?: string;

  // Security context
  ipAddress?: string;
  userAgent?: string;

  // Payment metadata
  packageId?: string;
  paymentMethod?: string;

  // System metadata
  version?: string;
  timestamp?: string;
}

export class TransactionMetadataValidator {
  static validate(metadata: any): TransactionMetadata {
    const validated: TransactionMetadata = {};

    // Safely extract and validate each field
    if (metadata?.model && typeof metadata.model === 'string') {
      validated.model = metadata.model.substring(0, 100);
    }

    if (metadata?.provider && ['openai', 'anthropic', 'groq'].includes(metadata.provider)) {
      validated.provider = metadata.provider;
    }

    if (metadata?.operation && ['generate', 'stream', 'embedding'].includes(metadata.operation)) {
      validated.operation = metadata.operation;
    }

    if (metadata?.requestId && typeof metadata.requestId === 'string') {
      validated.requestId = metadata.requestId.substring(0, 36);
    }

    if (metadata?.tokens && typeof metadata.tokens === 'object') {
      validated.tokens = {
        prompt: parseInt(metadata.tokens.prompt) || 0,
        completion: parseInt(metadata.tokens.completion) || 0,
        total: parseInt(metadata.tokens.total) || 0,
      };
    }

    if (metadata?.sessionId && typeof metadata.sessionId === 'string') {
      validated.sessionId = metadata.sessionId.substring(0, 36);
    }

    if (metadata?.chatId && typeof metadata.chatId === 'string') {
      validated.chatId = metadata.chatId.substring(0, 36);
    }

    if (metadata?.ipAddress && typeof metadata.ipAddress === 'string') {
      validated.ipAddress = metadata.ipAddress.substring(0, 45); // IPv6 max length
    }

    validated.timestamp = new Date().toISOString();

    return validated;
  }
}
