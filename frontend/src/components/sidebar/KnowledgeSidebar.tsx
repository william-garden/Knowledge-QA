import { useMemo, useState } from "react";
import { RotateCcw, Upload, FileText, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { KnowledgeDocument, UploadProgress } from "@/types";
import { useUploader } from "@/hooks/useUploader";

type KnowledgeSidebarProps = {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  uploader: ReturnType<typeof useUploader>;
  onRefresh: () => void;
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/x-pdf",
  "application/acrobat"
];

function UploadQueueItem({ item }: { item: UploadProgress }) {
  const statusText = getStatusLabel(item.status);

  return (
    <div className="rounded-md bg-slate-800/70 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{item.name}</span>
        <span className="text-xs text-slate-400">{statusText}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-slate-700">
        <div
          className={clsx(
            "h-full transition-all",
            item.status === "error" ? "bg-red-500" : "bg-accent"
          )}
          style={{ width: `${item.progress}%` }}
        />
      </div>
      {item.error ? (
        <p className="mt-2 text-xs text-red-400">{item.error}</p>
      ) : null}
    </div>
  );
}

function KnowledgeItem({ doc }: { doc: KnowledgeDocument }) {
  const date = useMemo(
    () => new Date(doc.ingested_at).toLocaleString(),
    [doc.ingested_at]
  );

  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
      <FileText className="mt-0.5 h-5 w-5 text-accent" />
      <div className="flex flex-col">
        <span className="font-semibold text-slate-100">{doc.filename}</span>
        <span className="text-xs text-slate-400">
          {prettyBytes(doc.size)} · {doc.chunk_count} chunks
        </span>
        <span className="mt-1 text-xs text-slate-500">{date}</span>
      </div>
    </li>
  );
}

export default function KnowledgeSidebar({
  documents,
  isLoading,
  uploader,
  onRefresh
}: KnowledgeSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    uploader.handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  return (
    <aside className="w-[340px] border-r border-slate-800 bg-sidebar text-slate-100 shadow-xl">
      <div className="flex h-full flex-col">
        <header className="border-b border-slate-800 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Knowledge Base Manager</h1>
              <p className="text-xs text-slate-400">
                Upload PDF or TXT files to build your personal knowledge store.
              </p>
            </div>
            <button
              onClick={onRefresh}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800 hover:border-accent hover:text-accent"
              title="Refresh knowledge base"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <div
            className={clsx(
              "relative mb-6 rounded-lg border border-dashed border-slate-600 bg-slate-900/30 p-6 transition-colors",
              isDragging && "border-accent bg-slate-900/70"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-10 w-10 text-accent" />
            <p className="mt-3 text-center text-sm text-slate-300">
              Drag files here, or{" "}
              <label className="mx-1 cursor-pointer text-accent underline underline-offset-2">
                browse files
                <input
                  type="file"
                  accept={[...ACCEPTED_TYPES, ".pdf", ".txt"].join(",")}
                  multiple
                  className="hidden"
                  onChange={(event) => uploader.handleFiles(event.target.files)}
                />
              </label>
              to upload PDF / TXT documents.
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              Recommended size: under 10 MB per file.
            </p>
          </div>

          {uploader.queue.length > 0 ? (
            <section className="mb-6 space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Upload progress</span>
                <button
                  className="text-accent hover:underline"
                  onClick={uploader.resetQueue}
                >
                  Clear
                </button>
              </div>
              {uploader.queue.map((item) => (
                <UploadQueueItem key={item.id} item={item} />
              ))}
            </section>
          ) : null}

          <section className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Knowledge base
              </h2>
              <span className="text-xs text-slate-500">
                {documents.length} document(s)
              </span>
            </div>
            {documents.length === 0 ? (
              <p className="rounded-md border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-500">
                No documents yet. Upload a file to populate the knowledge base.
              </p>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <KnowledgeItem key={doc.id} doc={doc} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}

function prettyBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getStatusLabel(status: UploadProgress["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "uploading":
      return "Uploading";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "error":
      return "Failed";
    default:
      return status;
  }
}
