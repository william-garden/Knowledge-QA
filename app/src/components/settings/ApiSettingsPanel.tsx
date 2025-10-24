import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, TestTube2 } from "lucide-react";
import type { AppSettings } from "@/lib/settingsStore";

interface ApiSettingsPanelProps {
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (settings: AppSettings) => Promise<void>;
  onTest: (settings: AppSettings) => Promise<void>;
  onClose: () => void;
}

const labelStyles = "text-sm font-medium text-slate-200";
const inputStyles =
  "mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export default function ApiSettingsPanel({
  settings,
  isLoading,
  isSaving,
  onSave,
  onTest,
  onClose
}: ApiSettingsPanelProps) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(settings),
    [form, settings]
  );

  const handleChange = (path: string, value: string) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as AppSettings;
      switch (path) {
        case "backend.baseUrl":
          next.backend.baseUrl = value;
          break;
        case "doubao.apiKey":
          next.doubao.apiKey = value;
          break;
        case "doubao.apiBase":
          next.doubao.apiBase = value;
          break;
        case "doubao.chatModel":
          next.doubao.chatModel = value;
          break;
        case "doubao.embeddingModel":
          next.doubao.embeddingModel = value;
          break;
        default:
          break;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setStatus("idle");
    setMessage(null);
    try {
      await onSave(form);
      setStatus("success");
      setMessage("Settings saved.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to save settings. Please try again."
      );
    }
  };

  const handleTest = async () => {
    setStatus("idle");
    setMessage(null);
    setIsTesting(true);
    try {
      await onTest(form);
      setStatus("success");
      setMessage("Connection test succeeded.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Connection test failed. Please check your configuration."
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-slate-950/80 p-8">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-slate-100">API Configuration</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 transition hover:border-accent hover:text-accent"
        >
          Back to Chat
        </button>
      </header>
      <p className="text-sm text-slate-400">
        Configure the knowledge-base backend and Doubao model parameters. Settings are stored locally on this device only.
      </p>

      <section className="space-y-4">
        <div>
          <label className={labelStyles} htmlFor="backend-base">
            Knowledge backend URL
          </label>
          <input
            id="backend-base"
            type="text"
            className={inputStyles}
            value={form.backend.baseUrl}
            onChange={(event) => handleChange("backend.baseUrl", event.target.value)}
            placeholder="http://127.0.0.1:8001/api"
          />
          <p className="mt-1 text-xs text-slate-500">
            Defaults to the local FastAPI service. Update this if you are using a remote deployment.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelStyles} htmlFor="doubao-key">
              Doubao API Key
            </label>
            <input
              id="doubao-key"
              type="password"
              className={inputStyles}
              value={form.doubao.apiKey}
              onChange={(event) => handleChange("doubao.apiKey", event.target.value)}
              placeholder="Enter your key"
            />
          </div>
          <div>
            <label className={labelStyles} htmlFor="doubao-base">
              Doubao API Base
            </label>
            <input
              id="doubao-base"
              type="text"
              className={inputStyles}
              value={form.doubao.apiBase}
              onChange={(event) => handleChange("doubao.apiBase", event.target.value)}
            />
          </div>
          <div>
            <label className={labelStyles} htmlFor="doubao-chat">
              Chat model
            </label>
            <input
              id="doubao-chat"
              type="text"
              className={inputStyles}
              value={form.doubao.chatModel}
              onChange={(event) => handleChange("doubao.chatModel", event.target.value)}
            />
          </div>
          <div>
            <label className={labelStyles} htmlFor="doubao-embedding">
              Embedding model
            </label>
            <input
              id="doubao-embedding"
              type="text"
              className={inputStyles}
              value={form.doubao.embeddingModel}
              onChange={(event) =>
                handleChange("doubao.embeddingModel", event.target.value)
              }
            />
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save settings
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleTest()}
            disabled={isLoading || isTesting}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="h-4 w-4" />
            )}
            Test connection
          </button>
        </div>
        {message ? (
          <p
            className={`text-sm ${
              status === "error"
                ? "text-red-400"
                : status === "success"
                  ? "text-emerald-400"
                  : "text-slate-400"
            }`}
          >
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

