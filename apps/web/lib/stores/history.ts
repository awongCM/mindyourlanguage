import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranslationRecord } from "@mindyourlanguage/shared";

export const HISTORY_MAX = 50;

interface HistoryStore {
  items: TranslationRecord[];
  add: (record: TranslationRecord) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      items: [],
      add: (record) =>
        set((state) => ({
          items: [
            record,
            ...state.items.filter((item) => item.id !== record.id),
          ].slice(0, HISTORY_MAX),
        })),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "myl-history" },
  ),
);
