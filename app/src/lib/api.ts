import type { AppSettings } from "@/lib/settingsStore";
import type {
  ConversationDetail,
  ConversationListResponse,
  KnowledgeChunksResponse,
  UploadResponse
} from "@/types";

type HeadersMap = Record<string, string>;

function sanitizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "http://127.0.0.1:8001/api";
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function buildHeaders(settings: AppSettings): HeadersMap {
  const headers: HeadersMap = {
    "X-LLM-Provider": settings.provider,
    "X-LLM-Api-Base": settings.doubao.apiBase.trim(),
    "X-LLM-Embedding-Model": settings.doubao.embeddingModel.trim(),
    "X-LLM-Chat-Model": settings.doubao.chatModel.trim()
  };
  const apiKey = settings.doubao.apiKey.trim();
  if (!apiKey) {
    throw new Error('Please configure the Doubao API key in API Settings.');
  }
  if (!apiKey) {
        throw new Error("Please configure the Doubao API key in API Settings.");
  }
  headers["X-LLM-Api-Key"] = apiKey;
  return headers;
}

function buildUrl(settings: AppSettings, path: string): string {
  const baseUrl = sanitizeBaseUrl(settings.backend.baseUrl);
  return `${baseUrl}${path}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchKnowledgeBase(settings: AppSettings): Promise<UploadResponse> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, "/knowledge-base"), {
    headers
  });
  return parseJson<UploadResponse>(response);
}

export function uploadFile(
  file: File,
  settings: AppSettings,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal
): Promise<UploadResponse> {
  const headers = buildHeaders(settings);
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(settings, "/upload"));

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    if (signal) {
      const abortHandler = () => {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      };
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error."));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as UploadResponse;
          resolve(payload);
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to parse upload response.")
          );
        }
      } else {
        reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
      }
    };

    xhr.send(formData);
  });
}

export async function streamAnswer(
  question: string,
  conversationId: string | null,
  settings: AppSettings,
  onMessage: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string | null> {
  const headers = buildHeaders(settings);
  headers["Content-Type"] = "application/json";
  headers["Accept"] = "text/event-stream";

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  const response = await fetch(buildUrl(settings, "/qa"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      question,
      conversation_id: conversationId ?? null
    }),
    signal: controller.signal
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || `QA request failed: ${response.statusText}`);
  }

  const resolvedConversationId =
    response.headers.get("x-conversation-id") ?? conversationId ?? null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneStreaming = false;

  while (!doneStreaming) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);

      if (!rawLine.startsWith("data:")) {
        continue;
      }

      let payload = rawLine.slice(5);
      if (payload.startsWith(" ")) {
        payload = payload.slice(1);
      }

      if (payload === "[DONE]") {
        doneStreaming = true;
        break;
      }

      if (!payload) {
        continue;
      }

      const text = payload.endsWith("\n") ? payload : `${payload}\n`;
      onMessage(text);
    }

    if (done) {
      doneStreaming = true;
    }
  }

  if (buffer) {
    const rawLine = buffer.replace(/\r$/, "");
    if (rawLine.startsWith("data:")) {
      let payload = rawLine.slice(5);
      if (payload.startsWith(" ")) {
        payload = payload.slice(1);
      }
      if (payload && payload !== "[DONE]") {
        const text = payload.endsWith("\n") ? payload : `${payload}\n`;
        onMessage(text);
      }
    }
  }

  return resolvedConversationId;
}

export async function deleteKnowledgeDocument(
  documentId: string,
  settings: AppSettings
): Promise<void> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, `/knowledge-base/${documentId}`), {
    method: "DELETE",
    headers
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to delete document: ${response.statusText}`);
  }
}

export async function clearKnowledgeBase(settings: AppSettings): Promise<void> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, "/knowledge-base"), {
    method: "DELETE",
    headers
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to clear knowledge base: ${response.statusText}`);
  }
}

export async function fetchDocumentChunks(
  documentId: string,
  settings: AppSettings
): Promise<KnowledgeChunksResponse> {
  const headers = buildHeaders(settings);
  const response = await fetch(
    buildUrl(settings, `/knowledge-base/${documentId}/chunks`),
    {
      headers
    }
  );
  return parseJson<KnowledgeChunksResponse>(response);
}

export async function fetchConversations(
  settings: AppSettings
): Promise<ConversationListResponse> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, "/conversations"), {
    headers
  });
  return parseJson<ConversationListResponse>(response);
}

export async function createConversation(
  payload: { title?: string | null },
  settings: AppSettings
): Promise<ConversationDetail> {
  const headers = buildHeaders(settings);
  headers["Content-Type"] = "application/json";
  const response = await fetch(buildUrl(settings, "/conversations"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  return parseJson<ConversationDetail>(response);
}

export async function getConversation(
  conversationId: string,
  settings: AppSettings
): Promise<ConversationDetail> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, `/conversations/${conversationId}`), {
    headers
  });
  return parseJson<ConversationDetail>(response);
}

export async function renameConversation(
  conversationId: string,
  title: string,
  settings: AppSettings
): Promise<ConversationDetail> {
  const headers = buildHeaders(settings);
  headers["Content-Type"] = "application/json";
  const response = await fetch(buildUrl(settings, `/conversations/${conversationId}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title })
  });
  return parseJson<ConversationDetail>(response);
}

export async function deleteConversation(
  conversationId: string,
  settings: AppSettings
): Promise<void> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, `/conversations/${conversationId}`), {
    method: "DELETE",
    headers
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to delete conversation: ${response.statusText}`);
  }
}

export async function clearConversations(settings: AppSettings): Promise<void> {
  const headers = buildHeaders(settings);
  const response = await fetch(buildUrl(settings, "/conversations"), {
    method: "DELETE",
    headers
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to clear conversations: ${response.statusText}`);
  }
}



