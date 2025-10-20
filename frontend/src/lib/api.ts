import { UploadResponse } from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ?? "/api";

export async function fetchKnowledgeBase(): Promise<UploadResponse> {
    console.log("API_BASE:", API_BASE);
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
}
