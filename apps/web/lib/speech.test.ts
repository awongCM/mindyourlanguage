import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSpeechSynthesisSupported,
  pickVoice,
  speakChinese,
  speakSegments,
  voiceMatchesRegion,
} from "./speech";

function mockVoice(lang: string, name: string): SpeechSynthesisVoice {
  return {
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice;
}

function stubSpeechSynthesis(voices: SpeechSynthesisVoice[] = []) {
  const speak = vi.fn();
  const cancel = vi.fn();
  const getVoices = vi.fn().mockReturnValue(voices);
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const synth = {
    speak,
    cancel,
    getVoices,
    addEventListener,
    removeEventListener,
  };
  vi.stubGlobal("window", { speechSynthesis: synth });
  return synth;
}

describe("isSpeechSynthesisSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when speechSynthesis missing", () => {
    vi.stubGlobal("window", {});
    expect(isSpeechSynthesisSupported()).toBe(false);
  });

  it("returns true when speechSynthesis present", () => {
    stubSpeechSynthesis();
    expect(isSpeechSynthesisSupported()).toBe(true);
  });
});

describe("pickVoice", () => {
  it("prefers exact zh-CN match for Mainland", () => {
    const voices = [
      mockVoice("zh-TW", "TW"),
      mockVoice("zh-CN", "CN"),
      mockVoice("en-US", "US"),
    ];
    expect(pickVoice(voices, "zh-CN")?.name).toBe("CN");
  });

  it("accepts cmn-TW prefix for Taiwan", () => {
    const voices = [mockVoice("cmn-TW", "Taiwan"), mockVoice("zh-CN", "CN")];
    expect(pickVoice(voices, "zh-TW")?.name).toBe("Taiwan");
  });

  it("falls back to any zh voice when region missing", () => {
    const voices = [mockVoice("zh-CN", "CN"), mockVoice("en-US", "US")];
    expect(pickVoice(voices, "zh-TW")?.name).toBe("CN");
  });
});

describe("voiceMatchesRegion", () => {
  it("matches exact region voices", () => {
    expect(voiceMatchesRegion(mockVoice("zh-TW", "TW"), "zh-TW")).toBe(true);
    expect(voiceMatchesRegion(mockVoice("zh-CN", "CN"), "zh-CN")).toBe(true);
  });

  it("does not treat Mainland voice as Taiwan match", () => {
    expect(voiceMatchesRegion(mockVoice("zh-CN", "CN"), "zh-TW")).toBe(false);
  });
});

describe("speakChinese", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubSpeechSynthesis([mockVoice("zh-CN", "CN")]);
    class MockUtterance {
      text: string;
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cancels prior speech and speaks with zh-CN", async () => {
    const promise = speakChinese("你好", "zh-CN");
    await vi.runAllTimersAsync();

    const synth = window.speechSynthesis;
    const utterance = vi.mocked(synth.speak).mock
      .calls[0]?.[0] as SpeechSynthesisUtterance;

    expect(synth.cancel).toHaveBeenCalled();
    expect(utterance.text).toBe("你好");
    expect(utterance.lang).toBe("zh-CN");
    utterance.onend?.(new Event("end") as SpeechSynthesisEvent);

    await expect(promise).resolves.toEqual({ usedRegionFallback: false });
  });

  it("reports region fallback when only Mainland voice exists for Taiwan", async () => {
    const promise = speakChinese("你好", "zh-TW");
    await vi.runAllTimersAsync();

    const utterance = vi.mocked(window.speechSynthesis.speak).mock
      .calls[0]?.[0] as SpeechSynthesisUtterance;
    utterance.onend?.(new Event("end") as SpeechSynthesisEvent);

    await expect(promise).resolves.toEqual({ usedRegionFallback: true });
  });

  it("applies custom rate when provided", async () => {
    const promise = speakChinese("你好", "zh-CN", { rate: 0.75 });
    await vi.runAllTimersAsync();

    const utterance = vi.mocked(window.speechSynthesis.speak).mock
      .calls[0]?.[0] as SpeechSynthesisUtterance & { rate?: number };
    expect(utterance.rate).toBe(0.75);
    utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
    await expect(promise).resolves.toEqual({ usedRegionFallback: false });
  });

  it("rejects when unsupported", async () => {
    vi.stubGlobal("window", {});
    await expect(speakChinese("你好", "zh-CN")).rejects.toThrow(/unavailable/i);
  });
});

describe("speakSegments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubSpeechSynthesis([mockVoice("zh-CN", "CN")]);
    class MockUtterance {
      text: string;
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("speaks each segment in order", async () => {
    const promise = speakSegments(["你", "好"], "zh-CN", { gapMs: 0 });

    await vi.runAllTimersAsync();
    const first = vi.mocked(window.speechSynthesis.speak).mock
      .calls[0]?.[0] as SpeechSynthesisUtterance;
    first.onend?.(new Event("end") as SpeechSynthesisEvent);
    await vi.runAllTimersAsync();
    const second = vi.mocked(window.speechSynthesis.speak).mock
      .calls[1]?.[0] as SpeechSynthesisUtterance;
    second.onend?.(new Event("end") as SpeechSynthesisEvent);

    await expect(promise).resolves.toEqual({ usedRegionFallback: false });
    expect(first.text).toBe("你");
    expect(second.text).toBe("好");
  });
});
