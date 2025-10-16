import { create } from "zustand";
import { KnowledgeDocument } from "@/types";

type KnowledgeState = {
  documents: KnowledgeDocument[];
  setDocuments: (docs: KnowledgeDocument[]) => void;
  upsertDocuments: (docs: KnowledgeDocument[]) => void;
};

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  documents: [],
  setDocuments: (docs) => set({ documents: docs }),
  upsertDocuments: (docs) =>
    set((state) => {
      const lookup = new Map(state.documents.map((doc) => [doc.id, doc]));
      docs.forEach((doc) => lookup.set(doc.id, doc));
      return { documents: Array.from(lookup.values()).sort(sortByDate) };
    })
}));

function sortByDate(a: KnowledgeDocument, b: KnowledgeDocument) {
  return new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime();
}
