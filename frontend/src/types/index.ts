export type KnowledgeDocument = {
  id: string;
  filename: string;
  size: number;
  chunk_count: number;
  ingested_at: string;
  source_path?: string | null;
};

export type UploadProgress = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

export type ProviderId = "doubao" | "chatgpt" | "gemini" | "grok";

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl: string;
  docUrl?: string;
};

export type ProviderSecret = {
  providerId: ProviderId;
  apiKey: string;
  baseUrl?: string | null;
  model?: string | null;
  organization?: string | null;
};

export type ProviderRuntimeRequest = {
  id: ProviderId;
  label?: string | null;
  model?: string | null;
  api_key: string;
  base_url?: string | null;
};

export type ConversationProvider = {
  id: ProviderId;
  name: string;
  model?: string | null;
};

export type ChatRequestBody = {
  question: string;
  top_k?: number;
  conversation_id?: string | null;
  provider: ProviderRuntimeRequest;
};

export type UploadResponse = {
  documents: KnowledgeDocument[];
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  provider: ConversationProvider;
};

export type ConversationDetail = {
  conversation: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    provider: ConversationProvider;
    messages: ConversationMessage[];
  };
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
};

export type KnowledgeChunksResponse = {
  chunks: string[];
};
