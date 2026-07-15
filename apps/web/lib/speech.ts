import type { VoiceRegion } from "@mindyourlanguage/shared";

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

export async function speakChinese(
  text: string,
  region: VoiceRegion,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (!isSpeechSynthesisSupported()) {
    throw new Error("Audio unavailable");
  }

  cancelSpeech();
  const voices = await waitForVoices();
  const voice = pickVoice(voices, region);
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = region;
  if (voice) utterance.voice = voice;

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Audio unavailable"));
    window.speechSynthesis.speak(utterance);
  });
}
