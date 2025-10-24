import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearKnowledgeBase,
  deleteKnowledgeDocument,
  fetchKnowledgeBase
} from "@/lib/api";
import { useKnowledgeStore } from "@/store/knowledge";
import { useUploader } from "@/hooks/useUploader";
import { useChat } from "@/hooks/useChat";
import { useSettings } from "@/hooks/useSettings";
import KnowledgeSidebar from "@/components/sidebar/KnowledgeSidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import ApiSettingsPanel from "@/components/settings/ApiSettingsPanel";

function App() {
  const settingsController = useSettings();
  const { settings, isLoading: isLoadingSettings, isSaving, updateSettings } = settingsController;
  const hasApiKey = useMemo(() => settings.doubao.apiKey.trim().length > 0, [settings.doubao.apiKey]);

  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-base", settings.backend.baseUrl, hasApiKey],
    enabled: !isLoadingSettings && hasApiKey,
    queryFn: () => fetchKnowledgeBase(settings)
  });

  const setDocuments = useKnowledgeStore((state) => state.setDocuments);
  const removeDocument = useKnowledgeStore((state) => state.removeDocument);
  const clearDocuments = useKnowledgeStore((state) => state.clearDocuments);
  const documents = useKnowledgeStore((state) => state.documents);

  const uploader = useUploader(settings);
  const chat = useChat(settings);

  useEffect(() => {
    if (!hasApiKey) {
      setActiveView("settings");
    }
  }, [hasApiKey]);

  useEffect(() => {
    if (data?.documents) {
      setDocuments(data.documents);
    }
  }, [data, setDocuments]);

  useEffect(() => {
    if (!hasApiKey) {
      clearDocuments();
    }
  }, [hasApiKey, clearDocuments]);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      try {
        await deleteKnowledgeDocument(id, settings);
        removeDocument(id);
        toast.success("Document deleted.");
        void refetch();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete document. Please try again.";
        toast.error(message);
      }
    },
    [refetch, removeDocument, settings]
  );

  const handleClearDocuments = useCallback(async () => {
    try {
      await clearKnowledgeBase(settings);
      clearDocuments();
      toast.success("Knowledge base cleared.");
      void refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear knowledge base. Please try again.";
      toast.error(message);
    }
  }, [clearDocuments, refetch, settings]);

  const handleSaveSettings = useCallback(
    async (nextSettings: typeof settings) => {
      await updateSettings(nextSettings);
      toast.success("API settings saved.");
      void refetch();
    },
    [refetch, updateSettings]
  );

  const handleTestSettings = useCallback(
    async (config: typeof settings) => {
      await fetchKnowledgeBase(config);
    },
    []
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KnowledgeSidebar
        documents={documents}
        isLoading={isLoading || isLoadingSettings}
        uploader={uploader}
        onRefresh={refetch}
        onDeleteDocument={(id) => {
          void handleDeleteDocument(id);
        }}
        onClearDocuments={() => {
          void handleClearDocuments();
        }}
        onOpenSettings={() => setActiveView("settings")}
        isSettingsActive={activeView === "settings"}
        settings={settings}
        hasApiKey={hasApiKey}
      />

      <div className="flex flex-1 flex-col">
        {activeView === "settings" ? (
          <ApiSettingsPanel
            settings={settings}
            isLoading={isLoadingSettings}
            isSaving={isSaving}
            onSave={handleSaveSettings}
            onTest={handleTestSettings}
            onClose={() => setActiveView("chat")}
          />
        ) : (
          <ChatWindow
            chat={chat}
            apiReady={hasApiKey}
            onOpenSettings={() => setActiveView("settings")}
          />
        )}
      </div>
    </div>
  );
}

export default App;



