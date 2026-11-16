const soundKey = (userId: string) => `team-chat-sound:${userId}`;
const mutedKey = (userId: string) => `team-chat-muted:${userId}`;

export function loadSoundEnabled(userId: string) {
  try {
    return localStorage.getItem(soundKey(userId)) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundEnabled(userId: string, enabled: boolean) {
  try {
    localStorage.setItem(soundKey(userId), enabled ? "on" : "off");
  } catch {
    // Sound preferences are optional when browser storage is unavailable.
  }
}

export function loadMutedConversations(userId: string): Record<string, boolean> {
  try {
    const value = JSON.parse(localStorage.getItem(mutedKey(userId)) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, muted]) => muted === true)) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function saveMutedConversations(userId: string, muted: Record<string, boolean>) {
  try {
    localStorage.setItem(mutedKey(userId), JSON.stringify(muted));
  } catch {
    // Mute still applies for this session when browser storage is unavailable.
  }
}

let audioContext: AudioContext | null = null;

type Tone = { frequency: number; delay: number; duration: number };

async function playTones(tones: Tone[]) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") await audioContext.resume();
    const start = audioContext.currentTime + 0.015;
    for (const tone of tones) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + tone.delay;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.055, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + tone.duration + 0.02);
    }
  } catch {
    // Browsers may block audio until the user's first interaction.
  }
}

export function playMessageSound(userId: string, conversationId: string) {
  if (!loadSoundEnabled(userId) || loadMutedConversations(userId)[conversationId]) return;
  void playTones([
    { frequency: 659.25, delay: 0, duration: 0.1 },
    { frequency: 880, delay: 0.075, duration: 0.14 },
  ]);
}

export function playAchievementSound(userId: string) {
  if (!loadSoundEnabled(userId)) return;
  void playTones([
    { frequency: 523.25, delay: 0, duration: 0.15 },
    { frequency: 659.25, delay: 0.12, duration: 0.16 },
    { frequency: 783.99, delay: 0.24, duration: 0.25 },
  ]);
}

export function previewMessageSound() {
  void playTones([
    { frequency: 659.25, delay: 0, duration: 0.1 },
    { frequency: 880, delay: 0.075, duration: 0.14 },
  ]);
}
