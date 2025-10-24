import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  RotateCcw,
  Upload,
  FileText,
  Loader2,
  Trash2,
  Eraser,
  Settings2
} from "lucide-react";
import clsx from "clsx";
import type { KnowledgeDocument, UploadProgress } from "@/types";
import type { AppSettings } from "@/lib/settingsStore";
import { fetchDocumentChunks } from "@/lib/api";

interface KnowledgeSidebarProps {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  uploader: {
    queue: UploadProgress[];
    handleFiles: (files: FileList | null) => Promise<void>;
    resetQueue: () => void;
  };
  onRefresh: () => void;
  onDeleteDocument: (id: string) => void;
  onClearDocuments: () => void;
  onOpenSettings: () => void;
  isSettingsActive: boolean;
  settings: AppSettings;
  hasApiKey: boolean;
}

const ACCEPTED_TYPES = ["text/plain", "text/markdown"];

function UploadQueueItem({ item }: { item: UploadProgress }) {
  const statusText = getStatusLabel(item.status);

  return (
    <div className="rounded-md bg-slate-800/70 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium text-slate-100">{item.name}</span>
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
      {item.error ? <p className="mt-2 text-xs text-red-400">{item.error}</p> : null}
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

function KnowledgeItem({ doc, onDelete, onChunksEnter, onChunksLeave, onChunksMove }: KnowledgeItemProps) {
  const date = useMemo(() => new Date(doc.ingested_at).toLocaleString(), [doc.ingested_at]);

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
        Delete
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
  onClearDocuments,
  onOpenSettings,
  isSettingsActive,
  settings,
  hasApiKey
}: KnowledgeSidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [chunkCache, setChunkCache] = useState<Record<string, string[]>>({});
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState({ visible: false, docId: null as string | null, x: 0, y: 0 });

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!hasApiKey) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    void uploader.handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!hasApiKey) return;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleChunksEnter = async (
    event: ReactMouseEvent<HTMLSpanElement>,
    docId: string
  ) => {
    event.persist();
    setTooltip({ visible: true, docId, x: event.clientX + 16, y: event.clientY + 16 });
    if (chunkCache[docId] || loadingDocId === docId) {
      return;
    }
    setLoadingDocId(docId);
    try {
      const response = await fetchDocumentChunks(docId, settings);
      setChunkCache((prev) => ({ ...prev, [docId]: response.chunks }));
    } catch (error) {
      console.warn(error instanceof Error ? error.message : "Unable to load document chunks");
    } finally {
      setLoadingDocId(null);
    }
  };

  const handleChunksLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const handleChunksMove = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (!tooltip.visible) return;
    setTooltip((prev) => ({ ...prev, x: event.clientX + 16, y: event.clientY + 16 }));
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    await onDeleteDocument(doc.id);
  };

  const handleClear = async () => {
    await onClearDocuments();
  };

  const tooltipChunks = tooltip.docId ? chunkCache[tooltip.docId] : undefined;
  const isTooltipLoading = loadingDocId === tooltip.docId;

  return (
    <aside className="flex h-full w-[360px] flex-col border-r border-slate-800 bg-slate-950/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Knowledge</h1>
          <p className="text-xs text-slate-500">Manage documents and API configuration</p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className={clsx(
            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition",
            isSettingsActive
              ? "border-accent bg-accent/20 text-accent"
              : "border-slate-700 bg-slate-800 text-slate-200 hover:border-accent hover:text-accent"
          )}
        >
          <Settings2 className="h-4 w-4" />
          API Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className={clsx(
            "mx-4 mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center transition",
            isDragging ? "border-accent bg-accent/10" : ""
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-6 w-6 text-accent" />
          <p className="mt-3 text-sm text-slate-200">
            Drag & drop or use the button below to upload TXT / Markdown files
          </p>
          <p className="mt-1 text-xs text-slate-500">For best results keep each file under 5 MB.</p>
        </div>

        <div className="px-4 pb-6">
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-accent hover:text-accent"
              disabled={isLoading || !hasApiKey}
            >
              <RotateCcw className={clsx("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </button>
            <label
              className={clsx(
                "inline-flex cursor-pointer items-center gap-2 rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition",
                hasApiKey ? "hover:bg-accent/20" : "pointer-events-none opacity-60"
              )}
            >
              <Upload className="h-4 w-4" />
              Select files
              <input
                type="file"
                accept={[".txt", ".md", ...ACCEPTED_TYPES].join(",")}
                multiple
                className="hidden"
                onChange={(event) => void uploader.handleFiles(event.target.files)}
                disabled={!hasApiKey}
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Supports UTF-8 text and Markdown. Uploads are chunked and embedded automatically.
          </p>

          {uploader.queue.length > 0 ? (
            <section className="mb-6 mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Upload queue</span>
                <button className="text-accent hover:underline" onClick={uploader.resetQueue}>
                  Clear
                </button>
              </div>
              {uploader.queue.map((item) => (
                <UploadQueueItem key={item.id} item={item} />
              ))}
            </section>
          ) : null}

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Documents</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{documents.length} documents</span>
                <button
                  type="button"
                  onClick={() => void handleClear()}
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
                No documents yet. Upload files to build your knowledge base.
              </p>
            ) : (
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <KnowledgeItem
                    key={doc.id}
                    doc={doc}
                    onDelete={() => void handleDelete(doc)}
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
              Loading document chunks…
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
            <span className="text-slate-400">No chunk content available for this document.</span>
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
