import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReviewEvent, ReviewGrade } from "@mindyourlanguage/shared";

export const REVIEW_EVENTS_MAX = 1000;
export const REVIEW_EVENTS_STORAGE_KEY = "myl-review-events";

function createEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `re-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ReviewEventsStore {
  events: ReviewEvent[];
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  append: (input: {
    phraseId: string;
    grade: ReviewGrade;
    reviewedAt?: string;
    mode?: ReviewEvent["mode"];
  }) => void;
  clear: () => void;
}

export const useReviewEventsStore = create<ReviewEventsStore>()(
  persist(
    (set) => ({
      events: [],
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      append: (input) =>
        set((state) => {
          const next: ReviewEvent = {
            id: createEventId(),
            phraseId: input.phraseId,
            grade: input.grade,
            reviewedAt: input.reviewedAt ?? new Date().toISOString(),
            mode: input.mode ?? "self_grade",
          };
          return {
            events: [next, ...state.events].slice(0, REVIEW_EVENTS_MAX),
          };
        }),
      clear: () => set({ events: [] }),
    }),
    {
      name: REVIEW_EVENTS_STORAGE_KEY,
      partialize: (state) => ({ events: state.events }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
