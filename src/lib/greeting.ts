// The estimator's opening line, in one place: the chat starts with it, and the phone plays a pre-recorded copy of it
// (public/voice/greeting.mp3, made with the same server voice as every other line) so it never depends on a network fetch
// or on the phone letting late audio play. If this text changes, regenerate that file (see the note in neuralVoice.ts).
export const GREETING_TEXT = 'Hello, citizen. What do you need painted?';
