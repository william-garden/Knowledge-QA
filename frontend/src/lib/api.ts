import { UploadResponse } from "@/types";

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
  onMessage: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_BASE}/qa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify({ question }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`QA request failed: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            return;
          }
          onMessage(payload);
        }
      });
  }
}
