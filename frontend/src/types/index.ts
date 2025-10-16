export type KnowledgeDocument = {
  id: string;
  filename: string;
  size: number;
  chunk_count: number;
  ingested_at: string;
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
};

export type UploadResponse = {
  documents: KnowledgeDocument[];
};
