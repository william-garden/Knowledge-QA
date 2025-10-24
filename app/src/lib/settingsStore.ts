import { Store } from "@tauri-apps/plugin-store";

export type DoubaoSettings = {
  apiKey: string;
  apiBase: string;
  chatModel: string;
  embeddingModel: string;
};

export type BackendSettings = {
  baseUrl: string;
};

export type AppSettings = {
  backend: BackendSettings;
  provider: "doubao";
  doubao: DoubaoSettings;
};

const STORE_PATH = "app-settings.dat";
const STORE_KEY = "appSettings";

const DEFAULT_SETTINGS: AppSettings = {
  backend: {
    baseUrl: "http://127.0.0.1:8001/api"
  },
  provider: "doubao",
  doubao: {
    apiKey: "",
    apiBase: "https://ark.cn-beijing.volces.com/api/v3",
    chatModel: "doubao-pro-128k",
    embeddingModel: "text-embedding-v1"
  }
};

let storeInstance: Store | null = null;

function getStore(): Store {
  if (!storeInstance) {
    storeInstance = new Store(STORE_PATH);
  }
  return storeInstance;
}

export async function loadSettings(): Promise<AppSettings> {
  const store = getStore();
  const raw = (await store.get(STORE_KEY)) as Partial<AppSettings> | null;
  if (!raw) {
    return DEFAULT_SETTINGS;
  }
  return {
    backend: {
      baseUrl: raw.backend?.baseUrl?.trim() || DEFAULT_SETTINGS.backend.baseUrl
    },
    provider: raw.provider ?? DEFAULT_SETTINGS.provider,
    doubao: {
      apiKey: raw.doubao?.apiKey ?? DEFAULT_SETTINGS.doubao.apiKey,
      apiBase: raw.doubao?.apiBase?.trim() || DEFAULT_SETTINGS.doubao.apiBase,
      chatModel: raw.doubao?.chatModel?.trim() || DEFAULT_SETTINGS.doubao.chatModel,
      embeddingModel:
        raw.doubao?.embeddingModel?.trim() || DEFAULT_SETTINGS.doubao.embeddingModel
    }
  };
}

export async function saveSettings(next: AppSettings): Promise<void> {
  const store = getStore();
  await store.set(STORE_KEY, next);
  await store.save();
}

export function getDefaultSettings(): AppSettings {
  return DEFAULT_SETTINGS;
}
