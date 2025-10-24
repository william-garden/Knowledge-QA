import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppSettings,
  getDefaultSettings,
  loadSettings,
  saveSettings
} from "@/lib/settingsStore";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await loadSettings();
        if (!cancelled) {
          setSettings(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load local settings. Please try again later."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (next: AppSettings) => {
    setSettings(next);
    setIsSaving(true);
    setError(null);
    try {
      await saveSettings(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save settings. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resetSettings = useCallback(async () => {
    const defaults = getDefaultSettings();
    await updateSettings(defaults);
  }, [updateSettings]);

  const safeSettings = useMemo(() => settings, [settings]);

  return {
    settings: safeSettings,
    isLoading,
    isSaving,
    error,
    setError,
    updateSettings,
    resetSettings
  };
}

export type SettingsController = ReturnType<typeof useSettings>;
