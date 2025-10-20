import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  RotateCcw,
  Upload,
  FileText,
  Loader2,
  Trash2,
  Eraser
} from "lucide-react";
import clsx from "clsx";
import type { KnowledgeDocument, UploadProgress } from "@/types";
import { useUploader } from "@/hooks/useUploader";
import { fetchDocumentChunks } from "@/lib/api";

interface KnowledgeSidebarProps {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  uploader: ReturnType<typeof useUploader>;
  onRefresh: () => void;
  onDeleteDocument: (id: string) => void;
  onClearDocuments: () => void;
}

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

interface KnowledgeItemProps {
  doc: KnowledgeDocument;
  onDelete: () => void;
  onChunksEnter: (event: ReactMouseEvent<HTMLSpanElement>, docId: string) => void;
  onChunksLeave: () => void;
  onChunksMove: (event: ReactMouseEvent<HTMLSpanElement>) => void;
}

function KnowledgeItem({
  doc,
  onDelete,
  onChunksEnter,
  onChunksLeave,
  onChunksMove
}: KnowledgeItemProps) {
  const date = useMemo(
    () => new Date(doc.ingested_at).toLocaleString(),
    [doc.ingested_at]
  );

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 text-accent" />
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100">{doc.filename}</span>
          <span className="text-xs text-slate-400">
            {prettyBytes(doc.size)} ·
            <span
              className="ml-1 cursor-help text-accent underline decoration-dotted"
              onMouseEnter={(event) => onChunksEnter(event, doc.id)}
              onMouseLeave={onChunksLeave}
              onMouseMove={onChunksMove}
            >
              {doc.chunk_count} chunks
            </span>
          </span>
          <span className="mt-1 text-xs text-slate-500">{date}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20"
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </button>
    </li>
  );
}

export default function KnowledgeSidebar({
  documents,
  isLoading,
  uploader,
  onRefresh,
  onDeleteDocument,
  onClearDocuments
}: KnowledgeSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [chunkCache, setChunkCache] = useState<Record<string, string[]>>({});
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    docId: string | null;
    x: number;
    y: number;
  }>({ visible: false, docId: null, x: 0, y: 0 });

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

  const showTooltip = (docId: string, x: number, y: number) => {
    setTooltip({ visible: true, docId, x, y });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, docId: null, x: 0, y: 0 });
  };

  const ensureChunksLoaded = async (docId: string) => {
    if (chunkCache[docId] || loadingDocId === docId) {
      return;
    }
    try {
      setLoadingDocId(docId);
      const response = await fetchDocumentChunks(docId);
      setChunkCache((prev) => ({ ...prev, [docId]: response.chunks }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load chunk details.";
      console.error(message);
    } finally {
      setLoadingDocId(null);
    }
  };

  const handleChunksEnter = async (event: ReactMouseEvent<HTMLSpanElement>, docId: string) => {
    const { clientX, clientY } = event;
    showTooltip(docId, clientX + 12, clientY + 12);
    void ensureChunksLoaded(docId);
  };

  const handleChunksMove = (event: ReactMouseEvent<HTMLSpanElement>) => {
    setTooltip((prev) =>
      prev.visible
        ? { ...prev, x: event.clientX + 12, y: event.clientY + 12 }
        : prev
    );
  };

  const handleChunksLeave = () => {
    hideTooltip();
  };

  const handleDelete = (doc: KnowledgeDocument) => {
    if (
      window.confirm(`确定删除文档“${doc.filename}”及其相关向量数据吗？`)
    ) {
      onDeleteDocument(doc.id);
    }
  };

  const handleClear = () => {
    if (
      documents.length > 0 &&
      window.confirm("确定要清空整个知识库吗？此操作无法恢复。")
    ) {
      onClearDocuments();
    }
  };

  const tooltipChunks = tooltip.docId ? chunkCache[tooltip.docId] : undefined;
  const isTooltipLoading = tooltip.docId !== null && loadingDocId === tooltip.docId;

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
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {documents.length} document(s)
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={documents.length === 0}
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>
            {documents.length === 0 ? (
              <p className="rounded-md border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-500">
                No documents yet. Upload a file to populate the knowledge base.
              </p>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <KnowledgeItem
                    key={doc.id}
                    doc={doc}
                    onDelete={() => handleDelete(doc)}
                    onChunksEnter={handleChunksEnter}
                    onChunksLeave={handleChunksLeave}
                    onChunksMove={handleChunksMove}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {tooltip.visible ? (
        <div
          className="pointer-events-none fixed z-50 w-80 max-w-xs overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs leading-relaxed text-slate-200 shadow-lg"
          style={{ top: tooltip.y, left: tooltip.x }}
        >
          {isTooltipLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading chunks...
            </div>
          ) : tooltipChunks && tooltipChunks.length > 0 ? (
            <ul className="space-y-2">
              {tooltipChunks.map((chunk, index) => (
                <li key={`${tooltip.docId}-${index}`} className="text-ellipsis break-words">
                  <span className="text-[10px] text-slate-500">Chunk {index + 1}</span>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">
                    {chunk.length > 320 ? `${chunk.slice(0, 320)}…` : chunk}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-400">No chunk content found for this document.</span>
          )}
        </div>
      ) : null}
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
