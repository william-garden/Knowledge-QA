import { useCallback, useState } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api";
import type { AppSettings } from "@/lib/settingsStore";
import { UploadProgress } from "@/types";
import { useKnowledgeStore } from "@/store/knowledge";

export function useUploader(settings: AppSettings) {
  const [queue, setQueue] = useState<UploadProgress[]>([]);
  const upsertDocuments = useKnowledgeStore((state) => state.upsertDocuments);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const accepted: File[] = [];
      Array.from(files).forEach((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        const isAccepted = extension === "txt" || extension === "md";
        if (!isAccepted) {
          toast.warning(`${file.name} must be a .txt or .md file.`);
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
            settings,
            (ratio) => {
              setQueue((prev) =>
                prev.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        status: "uploading",
                        progress: Math.round(ratio * 100)
                      }
                    : item
                )
              );
            }
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
            error instanceof Error ? error.message : "Unknown error. Please try again.";
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
    [settings, upsertDocuments]
  );

  const resetQueue = useCallback(() => setQueue([]), []);

  return {
    queue,
    handleFiles,
    resetQueue
  };
}

