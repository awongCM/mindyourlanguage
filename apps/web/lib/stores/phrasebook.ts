import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PhrasebookEntry,
  PracticeStats,
  ReviewGrade,
} from "@mindyourlanguage/shared";
import {
  createInitialPracticeStats,
  getDueEntries,
  recordReview as scheduleReview,
} from "@/lib/practice/srs";

function createEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface PhrasebookStore {
  items: PhrasebookEntry[];
  add: (entry: PhrasebookEntry) => void;
  update: (
    id: string,
    patch: Partial<Pick<PhrasebookEntry, "tags" | "notes" | "practiceStats">>,
  ) => void;
  remove: (id: string) => void;
  clear: () => void;
  isSaved: (
    entry: Pick<PhrasebookEntry, "translationId" | "sourceText" | "translation">,
  ) => boolean;
  recordReview: (id: string, grade: ReviewGrade, now?: Date) => void;
  getDueCount: (now?: Date) => number;
}

export function phrasebookEntryKey(
  entry: Pick<PhrasebookEntry, "translationId" | "sourceText" | "translation">,
): string {
  if (entry.translationId) return `id:${entry.translationId}`;
  return `text:${entry.sourceText}::${entry.translation}`;
}

export function entryMatchesSaved(
  saved: PhrasebookEntry,
  candidate: Pick<
    PhrasebookEntry,
    "translationId" | "sourceText" | "translation"
  >,
): boolean {
  return phrasebookEntryKey(saved) === phrasebookEntryKey(candidate);
}

export function filterPhrasebookByTag(
  items: PhrasebookEntry[],
  tagFilter: string,
): PhrasebookEntry[] {
  const query = tagFilter.trim().toLowerCase();
  if (!query) return items;

  return items.filter((item) =>
    item.tags.some((tag) => tag.toLowerCase().includes(query)),
  );
}

export const usePhrasebookStore = create<PhrasebookStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (entry) =>
        set((state) => ({
          items: [
            entry,
            ...state.items.filter((item) => !entryMatchesSaved(item, entry)),
          ],
        })),
      update: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        })),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      clear: () => set({ items: [] }),
      isSaved: (entry) =>
        get().items.some((item) => entryMatchesSaved(item, entry)),
      recordReview: (id, grade, now = new Date()) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const prior: PracticeStats =
              item.practiceStats ?? createInitialPracticeStats(now);
            return {
              ...item,
              practiceStats: scheduleReview(prior, grade, now),
            };
          }),
        })),
      getDueCount: (now = new Date()) => getDueEntries(get().items, now).length,
    }),
    { name: "myl-phrasebook" },
  ),
);

export function createPhrasebookEntry(
  input: Omit<PhrasebookEntry, "id" | "createdAt" | "tags" | "notes"> & {
    tags?: string[];
    notes?: string;
    practiceStats?: PracticeStats;
  },
): PhrasebookEntry {
  return {
    id: createEntryId(),
    tags: input.tags ?? [],
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
    translationId: input.translationId,
    sourceText: input.sourceText,
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    translation: input.translation,
    traditional: input.traditional,
    pinyin: input.pinyin,
    characterSet: input.characterSet,
    register: input.register,
    nativeAlternative: input.nativeAlternative,
    nativeNote: input.nativeNote,
    dictionaryMatches: input.dictionaryMatches ?? [],
    segments: input.segments ?? [],
    practiceStats: input.practiceStats ?? createInitialPracticeStats(),
  };
}
