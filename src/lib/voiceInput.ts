// Real in-app speech recognition — the native app only, on the phone's own on-device speech engine.
//
// This is NOT the phone's system keyboard dictation button (the mic every text field already has). That one is outside
// this app's control: the OS owns it, it never tells the page when the person pauses, and it commonly ducks or mutes the
// app's own audio while it listens — which is exactly why turning it on "overrode" the spoken replies. This module talks
// to the phone's speech engine directly, so the app decides when to listen and when to speak, and the two are never open
// at the same time.
//
// A "turn" is one utterance: start listening, live partial text comes back as the words are recognized. The phone's own
// engine is *supposed* to decide on its own when a pause means the person is done, the same instinct a phone operator
// has, and resolve with the final text at that moment — but in practice a continuous on-device recognition task often
// never reports that (no isFinal, no error) through an ordinary pause, and resuming speech after one can reset its own
// internal hypothesis and quietly drop everything heard before the pause. So a pause here commits the turn itself: once
// the partial text stops changing for PAUSE_COMMIT_MS, whatever was heard so far is taken as the finished answer and the
// native turn is stopped, instead of waiting on a native end-of-speech signal that may never come.
//
// Not available on the web (desktop or the mobile website): the plugin only wraps the phone's native recognizer. A
// browser tab keeps using the system keyboard's own mic, same as today.

import { LocalSpeech } from 'local-speech-plugin';
import { isNativeApp } from './platform';

export type VoicePermission = 'granted' | 'denied' | 'prompt';

let available: boolean | null = null;

/** Whether this device can listen at all (the native app, with the speech engine present). Cached after the first check. */
export async function isVoiceInputSupported(): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (available !== null) return available;
  try {
    const { available: a } = await LocalSpeech.available();
    available = a;
  } catch {
    available = false;
  }
  return available;
}

/** Asks for the microphone/speech permission if it hasn't been decided yet. */
export async function ensureVoicePermission(): Promise<VoicePermission> {
  try {
    const checked = await LocalSpeech.checkPermissions();
    if (checked.speechRecognition === 'granted') return 'granted';
    if (checked.speechRecognition === 'denied') return 'denied';
    const asked = await LocalSpeech.requestPermissions();
    return asked.speechRecognition === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

let listening = false;
let partialHandle: Awaited<ReturnType<typeof LocalSpeech.addListener>> | null = null;

export function isVoiceListening(): boolean {
  return listening;
}

/** How long a pause has to last, once some words have come in, before it counts as "done talking" and the turn is committed. */
const PAUSE_COMMIT_MS = 1400;

/**
 * One turn: listens until a pause of PAUSE_COMMIT_MS is heard after some speech (committed here, not left to the native
 * engine — see the file comment above), or until stopVoiceTurn() is called. `onPartial` fires repeatedly with what has
 * been heard so far, so the caller can show it live. Resolves with the final text (empty string if nothing was
 * understood, e.g. the person said nothing before giving up).
 */
export async function startVoiceTurn(onPartial: (text: string) => void): Promise<string> {
  if (!(await isVoiceInputSupported())) return '';
  if ((await ensureVoicePermission()) !== 'granted') return '';
  if (listening) await stopVoiceTurn();

  listening = true;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  const clearPauseTimer = () => {
    if (pauseTimer !== null) clearTimeout(pauseTimer);
    pauseTimer = null;
  };
  partialHandle = await LocalSpeech.addListener('partialResults', (data) => {
    const text = data.matches?.[0];
    if (!text) return;
    onPartial(text);
    // every new word pushes the pause-commit back out; once the words stop coming, this is what actually ends the turn
    clearPauseTimer();
    pauseTimer = setTimeout(() => {
      void stopVoiceTurn();
    }, PAUSE_COMMIT_MS);
  });

  try {
    const { matches } = await LocalSpeech.start({ language: 'en-US' });
    return matches?.[0] ?? '';
  } catch {
    return '';
  } finally {
    clearPauseTimer();
    listening = false;
    await partialHandle?.remove().catch(() => {});
    partialHandle = null;
  }
}

/** Ends the current turn early (the person tapped the mic off, or started typing instead). */
export async function stopVoiceTurn(): Promise<void> {
  if (!listening) return;
  try {
    await LocalSpeech.stop();
  } catch {
    // already stopped
  }
}
