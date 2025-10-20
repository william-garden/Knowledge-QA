import {
  ConversationDetail,
  ConversationListResponse,
  KnowledgeChunksResponse,
  UploadResponse
} from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "/api";

export async function fetchKnowledgeBase(): Promise<UploadResponse> {
  const response = await fetch(`${API_BASE}/knowledge-base`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Failed to load knowledge base: ${response.statusText}`);
  }

  return response.json();
}

export function uploadFile(
  file: File,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);
    xhr.responseType = "json";

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
        resolve(xhr.response as UploadResponse);
      } else {
        const detail =
          typeof xhr.response === "object" && xhr.response
            ? xhr.response.detail
            : undefined;
        reject(
          new Error(detail ?? `Upload failed with status ${xhr.status}.`)
        );
      }
    };

    xhr.send(formData);
  });
}

export async function streamAnswer(
  question: string,
  conversationId: string | null,
  onMessage: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string | null> {
  const response = await fetch(`${API_BASE}/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify({
      question,
      conversation_id: conversationId ?? null
    }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`QA request failed: ${response.statusText}`);
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

export async function deleteKnowledgeDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/knowledge-base/${documentId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
}

export async function clearKnowledgeBase(): Promise<void> {
  const response = await fetch(`${API_BASE}/knowledge-base`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to clear knowledge base: ${response.statusText}`);
  }
}

export async function fetchDocumentChunks(documentId: string): Promise<KnowledgeChunksResponse> {
  const response = await fetch(`${API_BASE}/knowledge-base/${documentId}/chunks`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to load document chunks: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchConversations(): Promise<ConversationListResponse> {
  const response = await fetch(`${API_BASE}/conversations`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to load conversations: ${response.statusText}`);
  }
  return response.json();
}

export async function createConversation(
  payload: { title?: string | null }
): Promise<ConversationDetail> {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Failed to create conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<ConversationDetail> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (!response.ok) {
    throw new Error(`Failed to rename conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
}

export async function clearConversations(): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to clear conversations: ${response.statusText}`);
  }
}
