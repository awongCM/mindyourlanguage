import type { VoiceRegion } from "@mindyourlanguage/shared";

export interface SpeakChineseResult {
  usedRegionFallback: boolean;
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined"
  );
}

export function cancelSpeech() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

function langCandidates(region: VoiceRegion): string[] {
  return region === "zh-TW"
    ? ["zh-TW", "zh-tw", "cmn-TW", "cmn-tw"]
    : ["zh-CN", "zh-cn", "cmn-CN", "cmn-cn"];
}

export function voiceMatchesRegion(
  voice: SpeechSynthesisVoice,
  region: VoiceRegion,
): boolean {
  const candidates = langCandidates(region);
  const lang = voice.lang.toLowerCase();
  return candidates.some(
    (candidate) =>
      lang === candidate.toLowerCase() ||
      lang.startsWith(`${candidate.toLowerCase()}-`),
  );
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  region: VoiceRegion,
): SpeechSynthesisVoice | null {
  const candidates = langCandidates(region);
  const exact = voices.find((v) => candidates.includes(v.lang));
  if (exact) return exact;

  const prefix = voices.find((v) =>
    candidates.some((c) => v.lang.toLowerCase().startsWith(c.toLowerCase())),
  );
  if (prefix) return prefix;

  return (
    voices.find((v) => {
      const lang = v.lang.toLowerCase();
      return lang.startsWith("zh") || lang.startsWith("cmn");
    }) ?? null
  );
}

function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}

async function waitForVoices(timeoutMs = 500): Promise<SpeechSynthesisVoice[]> {
  const existing = getVoices();
  if (existing.length > 0) return existing;

  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const NORMAL_SPEECH_RATE = 1;
export const SLOW_SPEECH_RATE = 0.55;
export const SLOW_SEGMENT_GAP_MS = 500;

export function chunkTextForSlowPlayback(
  text: string,
  segments: string[] = [],
): string[] {
  const cleanedSegments = segments.map((part) => part.trim()).filter(Boolean);
  if (cleanedSegments.length > 1) return cleanedSegments;

  const clauseParts = text
    .split(/(?<=[，。！？；：、,?!.])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (clauseParts.length > 1) return clauseParts;

  const chars = [...text].filter((char) => /\p{Script=Han}/u.test(char));
  if (chars.length > 1) return chars;

  const trimmed = text.trim();
  return trimmed ? [trimmed] : [];
}

export async function speakChinese(
  text: string,
  region: VoiceRegion,
  options: { rate?: number } = {},
): Promise<SpeakChineseResult> {
  const trimmed = text.trim();
  if (!trimmed) return { usedRegionFallback: false };

  if (!isSpeechSynthesisSupported()) {
    throw new Error("Audio unavailable");
  }

  cancelSpeech();
  // Chrome often ignores speak() immediately after cancel() in the same tick.
  await delay(0);

  const voices = await waitForVoices();
  const voice = pickVoice(voices, region);
  const usedRegionFallback = voice ? !voiceMatchesRegion(voice, region) : false;
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = region;
  if (voice) utterance.voice = voice;
  if (typeof options.rate === "number") {
    utterance.rate = options.rate;
  }

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Audio unavailable"));
    window.speechSynthesis.speak(utterance);
  });

  return { usedRegionFallback };
}

export async function speakChineseSlow(
  text: string,
  region: VoiceRegion,
  segments: string[] = [],
): Promise<SpeakChineseResult> {
  const parts = chunkTextForSlowPlayback(text, segments);
  if (parts.length === 0) return { usedRegionFallback: false };
  if (parts.length === 1) {
    return speakChinese(parts[0], region, { rate: SLOW_SPEECH_RATE });
  }
  return speakSegments(parts, region, {
    rate: SLOW_SPEECH_RATE,
    gapMs: SLOW_SEGMENT_GAP_MS,
  });
}

export async function speakSegments(
  segments: string[],
  region: VoiceRegion,
  options: { rate?: number; gapMs?: number } = {},
): Promise<SpeakChineseResult> {
  const parts = segments.map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { usedRegionFallback: false };

  let usedRegionFallback = false;
  for (let i = 0; i < parts.length; i += 1) {
    const result = await speakChinese(parts[i], region, { rate: options.rate });
    usedRegionFallback = usedRegionFallback || result.usedRegionFallback;
    if (i < parts.length - 1) {
      await delay(options.gapMs ?? 350);
    }
  }
  return { usedRegionFallback };
}
