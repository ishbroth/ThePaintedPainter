// A natural-sounding voice for phones and tablets: the words are turned into speech on the server (the "tts" function, Google neural
// voice) and played here. Desktop keeps the browser's own voices, which are already good there.
//
// Phones only play sound that was started from a real touch. One audio element is reused for everything and is "unlocked" with a short
// silent sound on the first touch, so audio that arrives a moment later (after the server answers) can still play.
// If the server voice isn't set up or can't be reached, nothing here throws: callers fall back to the phone's own voice.

import { supabaseUrl, supabaseAnonKey } from './supabase';

type NeuralState = 'unknown' | 'ready' | 'unavailable';
const STATE_KEY = 'ttp_neural_voice';

let state: NeuralState = (() => {
  try {
    return sessionStorage.getItem(STATE_KEY) === 'unavailable' ? 'unavailable' : 'unknown';
  } catch {
    return 'unknown';
  }
})();

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let playing = false;
let loading = 0;
let playToken = 0;
const cache = new Map<string, Promise<string | null>>();

function markUnavailable() {
  state = 'unavailable';
  try {
    sessionStorage.setItem(STATE_KEY, 'unavailable');
  } catch {
    // ignore
  }
}

/** A tenth of a second of silence as a WAV, built here so no file is needed. */
function silentWavUrl(): string {
  const samples = 800; // 0.1 s at 8 kHz
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  }
  return audio;
}

/** Call from a real touch or click: lets later audio play on a phone. */
export function unlockNeuralAudio(): void {
  if (unlocked || state === 'unavailable' || typeof Audio === 'undefined') return;
  unlocked = true;
  try {
    const el = getAudio();
    el.src = silentWavUrl();
    void el.play().catch(() => {
      unlocked = false;
    });
  } catch {
    unlocked = false;
  }
}

export function neuralVoiceAvailable(): boolean {
  return state !== 'unavailable' && typeof Audio !== 'undefined';
}

export function isNeuralPlaying(): boolean {
  return playing;
}

/** Playing, or fetching the audio that is about to play. */
export function isNeuralBusy(): boolean {
  return playing || loading > 0;
}

/** Fetches (and remembers) the audio for this text; resolves to a playable URL, or null if the server voice isn't available. */
export function prefetchNeural(text: string): Promise<string | null> {
  const key = text.trim();
  if (!key || state === 'unavailable') return Promise.resolve(null);
  const existing = cache.get(key);
  if (existing) return existing;
  const request = (async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: key }),
      });
      if (res.status === 503) {
        markUnavailable();
        return null;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as { audio?: string };
      if (!data.audio) return null;
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      state = 'ready';
      return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    } catch {
      return null;
    }
  })();
  cache.set(key, request);
  void request.then((url) => {
    if (!url) cache.delete(key); // try again next time
  });
  return request;
}

/** Plays the server voice. Resolves true when it played (or was cut off by newer speech), false if the caller should use the phone's voice. */
export async function speakNeural(text: string, onStart?: () => void): Promise<boolean> {
  if (!neuralVoiceAvailable()) return false;
  const token = ++playToken;
  loading++;
  let url: string | null;
  try {
    url = await prefetchNeural(text);
  } finally {
    loading--;
  }
  if (token !== playToken) return true; // something newer started (or speech was stopped) while this was loading
  if (!url) return false;
  const el = getAudio();
  return new Promise<boolean>((resolve) => {
    el.onended = () => {
      if (token === playToken) playing = false;
      resolve(true);
    };
    el.onerror = () => {
      if (token === playToken) playing = false;
      resolve(false);
    };
    el.src = url;
    playing = true;
    onStart?.();
    el.play().catch(() => {
      if (token === playToken) playing = false;
      resolve(false);
    });
  });
}

export function stopNeural(): void {
  playToken++;
  playing = false;
  if (audio) {
    audio.onended = null;
    audio.pause();
  }
}
