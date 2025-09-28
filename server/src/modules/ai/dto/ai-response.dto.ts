export interface AIResponseDto {
    id: string;
    content: string;
    model: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    creditsUsed: number;
    finishReason: string;
}

export interface StreamChunkDto {
    id: string;
    content: string;
    delta: string;
    usage?: {
        totalTokens: number;
    };
    creditsUsed?: number;
    done: boolean;
}
