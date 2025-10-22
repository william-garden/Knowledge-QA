import { create } from "zustand";

import {
  ProviderDefinition,
  ProviderId,
  ProviderRuntimeRequest,
  ProviderSecret
} from "@/types";
import { invokeTauri, isTauri } from "@/lib/runtime";

const PROVIDER_SECRETS_KEY = "knowledgeqa.providers.secrets";
const ACTIVE_PROVIDER_KEY = "knowledgeqa.providers.active";

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "doubao",
    label: "豆包 (Doubao)",
    description: "火山引擎豆包大模型，需配置火山引擎 API Key。",
    defaultModel: "doubao-seed-1-6-251015",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    docUrl: "https://www.volcengine.com/docs/82379"
  },
  {
    id: "chatgpt",
    label: "OpenAI ChatGPT",
    description: "OpenAI Chat Completions API（gpt-4o / gpt-4o-mini 等）。",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    docUrl: "https://platform.openai.com/docs/api-reference/chat/create"
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Google Generative Language API。",
    defaultModel: "gemini-1.5-pro-latest",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docUrl: "https://ai.google.dev/docs"
  },
  {
    id: "grok",
    label: "xAI Grok",
    description: "xAI Grok 模型，OpenAI 兼容接口。",
    defaultModel: "grok-beta",
    defaultBaseUrl: "https://api.x.ai/v1",
    docUrl: "https://docs.x.ai/docs"
  }
];

type ProviderState = {
  definitions: ProviderDefinition[];
  secrets: Record<ProviderId, ProviderSecret>;
  activeProviderId: ProviderId;
  ready: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  setActiveProvider: (id: ProviderId) => Promise<void>;
  saveSecret: (secret: ProviderSecret) => Promise<void>;
  deleteSecret: (providerId: ProviderId) => Promise<void>;
  getRuntimeConfig: (providerId?: ProviderId) => ProviderRuntimeRequest | null;
};

function toRecord(secrets: ProviderSecret[]): Record<ProviderId, ProviderSecret> {
  return secrets.reduce<Record<ProviderId, ProviderSecret>>((acc, secret) => {
    acc[secret.providerId] = secret;
    return acc;
  }, {} as Record<ProviderId, ProviderSecret>);
}

function serializeSecrets(secrets: Record<ProviderId, ProviderSecret>): ProviderSecret[] {
  return Object.values(secrets);
}

function persistenceAvailable(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readLocalSecrets(): ProviderSecret[] {
  if (!persistenceAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(PROVIDER_SECRETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProviderSecret[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSecrets(secrets: Record<ProviderId, ProviderSecret>): void {
  if (!persistenceAvailable()) return;
  window.localStorage.setItem(PROVIDER_SECRETS_KEY, JSON.stringify(serializeSecrets(secrets)));
}

function readLocalActive(): ProviderId | null {
  if (!persistenceAvailable()) return null;
  return (window.localStorage.getItem(ACTIVE_PROVIDER_KEY) as ProviderId | null) ?? null;
}

function writeLocalActive(id: ProviderId): void {
  if (!persistenceAvailable()) return;
  window.localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
}

function mapFromRust(secret: { provider_id: string; api_key: string; base_url?: string | null; organization?: string | null; model?: string | null }): ProviderSecret {
  return {
    providerId: secret.provider_id as ProviderId,
    apiKey: secret.api_key,
    baseUrl: secret.base_url ?? null,
    organization: secret.organization ?? null,
    model: secret.model ?? null
  };
}

function mapToRust(secret: ProviderSecret) {
  return {
    provider_id: secret.providerId,
    api_key: secret.apiKey,
    base_url: secret.baseUrl ?? null,
    organization: secret.organization ?? null,
    model: secret.model ?? null
  };
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  definitions: PROVIDER_DEFINITIONS,
  secrets: {},
  activeProviderId: "doubao",
  ready: false,
  loading: false,
  error: null,
  async load() {
    if (get().loading || get().ready) return;
    set({ loading: true, error: null });
    try {
      let secrets: ProviderSecret[] = [];
      let active: ProviderId | null = null;
      if (isTauri()) {
        const rawSecrets = await invokeTauri<{ provider_id: string; api_key: string; base_url?: string | null; model?: string | null; organization?: string | null }[]>(
          "list_provider_secrets"
        );
        secrets = rawSecrets.map(mapFromRust);
        const activeRaw = await invokeTauri<string | null>("get_active_provider");
        active = (activeRaw ?? null) as ProviderId | null;
      } else {
        secrets = readLocalSecrets();
        active = readLocalActive();
      }
      const secretRecord = toRecord(secrets);
      const defaultProvider = active ?? get().activeProviderId;
      set({
        secrets: secretRecord,
        activeProviderId: defaultProvider,
        ready: true,
        loading: false
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load provider configuration.";
      set({ error: message, loading: false, ready: true });
    }
  },
  async setActiveProvider(id) {
    set({ activeProviderId: id });
    if (isTauri()) {
      await invokeTauri("set_active_provider", { provider_id: id });
    } else {
      writeLocalActive(id);
    }
  },
  async saveSecret(secret) {
    set((state) => ({
      secrets: {
        ...state.secrets,
        [secret.providerId]: secret
      }
    }));
    if (isTauri()) {
      await invokeTauri("upsert_provider_secret", { secret: mapToRust(secret) });
    } else {
      writeLocalSecrets(get().secrets);
    }
  },
  async deleteSecret(providerId) {
    set((state) => {
      const next = { ...state.secrets };
      delete next[providerId];
      return { secrets: next };
    });
    if (isTauri()) {
      await invokeTauri("remove_provider_secret", { provider_id: providerId });
    } else {
      writeLocalSecrets(get().secrets);
    }
  },
  getRuntimeConfig(providerId) {
    const state = get();
    const targetId = providerId ?? state.activeProviderId;
    const definition = state.definitions.find((item) => item.id === targetId);
    if (!definition) {
      return null;
    }
    const secret = state.secrets[targetId];
    const apiKey = secret?.apiKey ?? null;
    const baseUrl = secret?.baseUrl ?? definition.defaultBaseUrl;
    const model = secret?.model ?? definition.defaultModel;
    if (!apiKey) {
      return null;
    }
    return {
      id: targetId,
      label: definition.label,
      api_key: apiKey,
      base_url: baseUrl,
      model
    };
  }
}));
