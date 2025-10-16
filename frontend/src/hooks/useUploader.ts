import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api";
import { UploadProgress } from "@/types";
import { useKnowledgeStore } from "@/store/knowledge";

export function useUploader() {
  const [queue, setQueue] = useState<UploadProgress[]>([]);
  const abortController = useRef<AbortController | null>(null);
  const upsertDocuments = useKnowledgeStore((state) => state.upsertDocuments);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const accepted: File[] = [];
      Array.from(files).forEach((file) => {
        const isAccepted =
          file.type === "application/pdf" || file.type === "text/plain";
        if (!isAccepted) {
          toast.warning(`${file.name} has an unsupported file type.`);
          return;
        }
        accepted.push(file);
        setQueue((prev) => [
          ...prev,
          {
            id: `${file.name}-${file.lastModified}`,
            name: file.name,
            status: "pending",
            progress: 0
          }
        ]);
      });

      abortController.current?.abort();
      abortController.current = new AbortController();
      const signal = abortController.current.signal;

      for (const file of accepted) {
        const id = `${file.name}-${file.lastModified}`;
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: "uploading", progress: 0 } : item
          )
        );

        try {
          const response = await uploadFile(
            file,
            (ratio) => {
              setQueue((prev) =>
                prev.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status: "uploading",
                        progress: Math.round(ratio * 90)
                      }
                    : item
                )
              );
            },
            signal
          );

          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "processing", progress: 95 }
                : item
            )
          );

          upsertDocuments(response.documents);
          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "completed", progress: 100 }
                : item
            )
          );
          toast.success(`${file.name} uploaded successfully.`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error.";
          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "error", progress: 0, error: message }
                : item
            )
          );
          toast.error(`${file.name} failed to upload: ${message}`);
        }
      }
    },
    [upsertDocuments]
  );

  const resetQueue = useCallback(() => setQueue([]), []);

  return {
    queue,
    handleFiles,
    resetQueue
  };
}
