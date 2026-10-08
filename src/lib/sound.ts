// Sound + voice notification helpers. Browsers block autoplay before a user
// gesture, so we lazily unlock the AudioContext on the first interaction and
// gracefully fall back to a silent toast when audio is unavailable.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

export type ToneKind = "order" | "ready" | "call" | "success" | "error";

const TONES: Record<ToneKind, { freq: number[]; dur: number; type: OscillatorType }> = {
  order: { freq: [587.33, 880], dur: 0.14, type: "sine" },
  ready: { freq: [784, 1046.5, 1318.5], dur: 0.15, type: "triangle" },
  call: { freq: [880, 660, 880], dur: 0.18, type: "square" },
  success: { freq: [523.25, 659.25, 783.99], dur: 0.12, type: "sine" },
  error: { freq: [220, 174.61], dur: 0.2, type: "sawtooth" },
};

export function playTone(kind: ToneKind) {
  const c = getCtx();
  if (!c) return;
  void c.resume();
  const { freq, dur, type } = TONES[kind];
  freq.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    const t0 = c.currentTime + i * dur;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  });
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak a phrase (currently tuned for Uzbek number words). */
export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR"; // closest available voice for Uzbek numerals
    u.rate = 0.98;
    u.pitch = 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

const UZ_NUM: Record<number, string> = {
  1: "bir", 2: "ikki", 3: "uch", 4: "to‘rt", 5: "besh", 6: "olti",
  7: "yetti", 8: "sakkiz", 9: "to‘qqiz", 10: "o‘n", 11: "o‘n bir",
  12: "o‘n ikki", 13: "o‘n uch", 14: "o‘n to‘rt", 15: "o‘n besh",
  16: "o‘n olti", 17: "o‘n yetti", 18: "o‘n sakkiz", 19: "o‘n to‘qqiz", 20: "yigirma",
};

export function uzNumber(n: number): string {
  return UZ_NUM[n] ?? String(n);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export function browserNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.svg" });
    }
  } catch {
    /* noop */
  }
}
