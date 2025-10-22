import { useEffect, useMemo, useState } from "react";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useProviderStore } from "@/store/providers";
import type { ProviderDefinition, ProviderId, ProviderSecret } from "@/types";

type ProviderSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

type ProviderFormState = Record<
  ProviderId,
  {
    apiKey: string;
    baseUrl: string;
    model: string;
  }
>;

const inputStyle =
  "w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none";

export function ProviderSettingsModal({ open, onClose }: ProviderSettingsModalProps) {
  const definitions = useProviderStore((state) => state.definitions);
  const secrets = useProviderStore((state) => state.secrets);
  const saveSecret = useProviderStore((state) => state.saveSecret);
  const deleteSecret = useProviderStore((state) => state.deleteSecret);
  const setActiveProvider = useProviderStore((state) => state.setActiveProvider);
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const [formState, setFormState] = useState<ProviderFormState>({} as ProviderFormState);

  const initializeState = useMemo(() => {
    const initial: ProviderFormState = {} as ProviderFormState;
    for (const definition of definitions) {
      const secret = secrets[definition.id];
      initial[definition.id] = {
        apiKey: secret?.apiKey ?? "",
        baseUrl: secret?.baseUrl ?? definition.defaultBaseUrl,
        model: secret?.model ?? definition.defaultModel
      };
    }
    return initial;
  }, [definitions, secrets]);

  useEffect(() => {
    if (open) {
      setFormState(initializeState);
    }
  }, [open, initializeState]);

  if (!open) {
    return null;
  }

  const handleChange = (
    providerId: ProviderId,
    field: keyof ProviderFormState[ProviderId],
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value
      }
    }));
  };

  const handleSave = async (provider: ProviderDefinition) => {
    const state = formState[provider.id];
    if (!state.apiKey.trim()) {
      toast.error("API Key 不能为空。");
      return;
    }
    const payload: ProviderSecret = {
      providerId: provider.id,
      apiKey: state.apiKey.trim(),
      baseUrl: state.baseUrl.trim() || provider.defaultBaseUrl,
      model: state.model.trim() || provider.defaultModel
    };
    try {
      await saveSecret(payload);
      toast.success(`${provider.label} 的 API Key 已保存。`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `保存 ${provider.label} 配置失败。`;
      toast.error(message);
    }
  };

  const handleReset = async (provider: ProviderDefinition) => {
    try {
      await deleteSecret(provider.id);
      setFormState((prev) => ({
        ...prev,
        [provider.id]: {
          apiKey: "",
          baseUrl: provider.defaultBaseUrl,
          model: provider.defaultModel
        }
      }));
      toast.success(`${provider.label} 配置已清除。`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `清除 ${provider.label} 配置失败。`;
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="relative h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">API 管理</h3>
            <p className="text-sm text-slate-400">
              为不同模型配置 API Key、Base URL 与默认模型。数据仅保存在本地。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-accent hover:text-accent"
          >
            关闭
          </button>
        </header>
        <div className="h-full overflow-y-auto px-5 py-6">
          <div className="space-y-5">
            {definitions.map((provider) => {
              const state = formState[provider.id];
              const hasSecret = Boolean(secrets[provider.id]);
              if (!state) return null;
              return (
                <section
                  key={provider.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-inner"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-100">{provider.label}</h4>
                      <p className="text-sm text-slate-400">{provider.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void setActiveProvider(provider.id)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition ${
                          activeProviderId === provider.id
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-slate-700 bg-slate-800 text-slate-300 hover:border-accent hover:text-accent"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        设为默认
                      </button>
                      {provider.docUrl ? (
                        <a
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 transition hover:border-accent hover:text-accent"
                          href={provider.docUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          文档
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      API Key
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="password"
                          className={`${inputStyle} pl-9`}
                          value={state.apiKey}
                          onChange={(event) =>
                            handleChange(provider.id, "apiKey", event.target.value)
                          }
                          placeholder="sk-..."
                        />
                      </div>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Base URL
                      <input
                        type="text"
                        className={inputStyle}
                        value={state.baseUrl}
                        onChange={(event) =>
                          handleChange(provider.id, "baseUrl", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      默认模型
                      <input
                        type="text"
                        className={inputStyle}
                        value={state.model}
                        onChange={(event) =>
                          handleChange(provider.id, "model", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      {hasSecret ? "已保存的凭据仅保存在本地。" : "尚未保存 API Key。"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReset(provider)}
                        className="rounded-md border border-red-500/50 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/10"
                      >
                        清除
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave(provider)}
                        className="rounded-md border border-accent/50 bg-accent/10 px-3 py-1 text-xs text-accent transition hover:bg-accent/20"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
