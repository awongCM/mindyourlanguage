import { describe, expect, it } from "vitest";
import type { PhrasebookEntry, TranslationRecord } from "@mindyourlanguage/shared";
import { findRestoreTarget } from "./restore-target";

const phrase = { id: "p1" } as PhrasebookEntry;
const record = { id: "h1" } as TranslationRecord;

describe("findRestoreTarget", () => {
  it("finds a phrasebook entry by id", () => {
    expect(findRestoreTarget([phrase], [record], "p1")).toEqual({
      kind: "phrasebook",
      entry: phrase,
    });
  });

  it("finds a history record by id", () => {
    expect(findRestoreTarget([phrase], [record], "h1")).toEqual({
      kind: "history",
      record,
    });
  });

  it("prefers the phrasebook when both stores contain the id", () => {
    const shared = { id: "same" } as PhrasebookEntry;
    const sharedRecord = { id: "same" } as TranslationRecord;
    expect(findRestoreTarget([shared], [sharedRecord], "same")?.kind).toBe(
      "phrasebook",
    );
  });

  it("returns null when the id is unknown", () => {
    expect(findRestoreTarget([phrase], [record], "nope")).toBeNull();
  });
});