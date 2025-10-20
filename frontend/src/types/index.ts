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

export type ChatRequestBody = {
  question: string;
  top_k?: number;
  conversation_id?: string | null;
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
};

export type ConversationDetail = {
  conversation: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    messages: ConversationMessage[];
  };
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
};

export type KnowledgeChunksResponse = {
  chunks: string[];
};
