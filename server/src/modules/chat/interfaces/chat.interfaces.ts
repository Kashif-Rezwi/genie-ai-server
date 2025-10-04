export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  creditsBalance?: number;
  isActive?: boolean;
}

export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  creditsUsed: number;
  createdAt: Date;
}

export interface ChatResponse {
  id: string;
  title: string;
  systemPrompt?: string;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatDetailResponse {
  id: string;
  title: string;
  systemPrompt?: string;
  messages: MessageResponse[];
  totalCreditsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamingChatResponse {
  chatId: string;
  messageId: string;
  content: string;
  delta: string;
  model?: string;
  creditsUsed?: number;
  done: boolean;
  error?: string;
}

export interface ChatStats {
  totalChats: number;
  totalMessages: number;
  totalCreditsUsed: number;
  averageMessagesPerChat: number;
}

export interface ModelUsage {
  model: string;
  messageCount: number;
  totalCreditsUsed: number;
}

export interface RecentActivity {
  date: string;
  messageCount: number;
  creditsUsed: number;
}

export interface ChatAnalytics extends ChatStats {
  modelUsage: ModelUsage[];
  recentActivity: RecentActivity[];
  averageCostPerMessage: number;
}

export interface CostAnalysis {
  totalCost: number;
  messagesByModel: Array<{
    model: string;
    count: number;
    totalCost: number;
  }>;
}

export interface ConversationHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
