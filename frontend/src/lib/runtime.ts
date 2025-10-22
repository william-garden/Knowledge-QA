export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("Tauri runtime is not available.");
  }
  const { invoke } = await import("@tauri-apps/api/tauri");
  return invoke<T>(command, args);
}
