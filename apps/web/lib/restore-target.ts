import type {
  PhrasebookEntry,
  TranslationRecord,
} from "@mindyourlanguage/shared";

export type RestoreTarget =
  | { kind: "phrasebook"; entry: PhrasebookEntry }
  | { kind: "history"; record: TranslationRecord };

export function findRestoreTarget(
  phrasebookItems: PhrasebookEntry[],
  historyItems: TranslationRecord[],
  id: string,
): RestoreTarget | null {
  const entry = phrasebookItems.find((item) => item.id === id);
  if (entry) return { kind: "phrasebook", entry };
  const record = historyItems.find((item) => item.id === id);
  if (record) return { kind: "history", record };
  return null;
}