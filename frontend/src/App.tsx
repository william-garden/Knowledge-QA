import { useCallback, useEffect } from "react";
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
import KnowledgeSidebar from "@/components/sidebar/KnowledgeSidebar";
import ChatWindow from "@/components/chat/ChatWindow";

function App() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-base"],
    queryFn: fetchKnowledgeBase
  });
  const setDocuments = useKnowledgeStore((state) => state.setDocuments);
  const removeDocument = useKnowledgeStore((state) => state.removeDocument);
  const clearDocuments = useKnowledgeStore((state) => state.clearDocuments);
  const documents = useKnowledgeStore((state) => state.documents);
  const uploader = useUploader();
  const chat = useChat();

  useEffect(() => {
    if (data?.documents) {
      setDocuments(data.documents);
    }
  }, [data, setDocuments]);

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      try {
        await deleteKnowledgeDocument(id);
        removeDocument(id);
        toast.success("文档已删除");
        void refetch();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "删除文档失败，请稍后重试。";
        toast.error(message);
      }
    },
    [removeDocument, refetch]
  );

  const handleClearDocuments = useCallback(async () => {
    try {
      await clearKnowledgeBase();
      clearDocuments();
      toast.success("已清空知识库");
      void refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "清空知识库失败，请稍后重试。";
      toast.error(message);
    }
  }, [clearDocuments, refetch]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KnowledgeSidebar
        documents={documents}
        isLoading={isLoading}
        uploader={uploader}
        onRefresh={refetch}
        onDeleteDocument={(id) => {
          void handleDeleteDocument(id);
        }}
        onClearDocuments={() => {
          void handleClearDocuments();
        }}
      />
      <ChatWindow chat={chat} />
    </div>
  );
}

export default App;
