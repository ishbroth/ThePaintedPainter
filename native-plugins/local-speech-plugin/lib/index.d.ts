import type { PermissionState } from '@capacitor/core';

export interface LocalSpeechPermissionStatus {
  speechRecognition: PermissionState;
}

export interface LocalSpeechPlugin {
  /** Whether the device's speech recognizer is available at all. */
  available(): Promise<{ available: boolean }>;
  checkPermissions(): Promise<LocalSpeechPermissionStatus>;
  requestPermissions(): Promise<LocalSpeechPermissionStatus>;
  /**
   * Starts one turn: listens until the device's own speech engine hears a pause and decides the person is done, or
   * until stop() is called. Resolves with the final transcript (`matches[0]`), or an empty array if nothing was heard.
   */
  start(options?: { language?: string }): Promise<{ matches?: string[] }>;
  /** Ends the current turn early. */
  stop(): Promise<void>;
  /** Fires repeatedly while listening, with the best transcript heard so far. */
  addListener(
    eventName: 'partialResults',
    listenerFunc: (data: { matches: string[] }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
}

export declare const LocalSpeech: LocalSpeechPlugin;
