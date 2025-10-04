import { Injectable, BadRequestException } from '@nestjs/common';
import { AIProvider } from './base-ai.provider';
import { GenericAIProvider } from './generic-ai.provider';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';

@Injectable()
export class AIProviderFactory {
  private readonly providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers.set('openai', new GenericAIProvider(openai, 'gpt-3.5-turbo', 'openai'));
    this.providers.set(
      'anthropic',
      new GenericAIProvider(anthropic, 'claude-3-haiku-20240307', 'anthropic')
    );
    this.providers.set('groq', new GenericAIProvider(groq, 'llama-3.1-8b-instant', 'groq'));
  }

  getProvider(providerName: string): AIProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Provider ${providerName} not supported`);
    }
    return provider;
  }

  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  isProviderSupported(providerName: string): boolean {
    return this.providers.has(providerName);
  }
}
