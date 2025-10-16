import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchKnowledgeBase } from "@/lib/api";
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
  const documents = useKnowledgeStore((state) => state.documents);
  const uploader = useUploader();
  const chat = useChat();

  useEffect(() => {
    if (data?.documents) {
      setDocuments(data.documents);
    }
  }, [data, setDocuments]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KnowledgeSidebar
        documents={documents}
        isLoading={isLoading}
        uploader={uploader}
        onRefresh={refetch}
      />
      <ChatWindow chat={chat} />
    </div>
  );
}

export default App;
