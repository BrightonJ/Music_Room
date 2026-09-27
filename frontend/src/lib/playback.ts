// Pure helpers (unit tested)

export type PlaybackClock = {
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  receivedAt: number; // local Date.now() when the server state was received
};

// The server sends the position at send time; the client only adds the time
// elapsed since reception, so phone clocks do not need to be synchronized.
export function currentPositionMs(clock: PlaybackClock, now: number = Date.now()): number {
  const position = clock.isPlaying ? clock.positionMs + (now - clock.receivedAt) : clock.positionMs;
  return Math.max(0, Math.min(clock.durationMs, position));
}

// Pressing the same vote again removes it
export function nextVoteValue(current: number | undefined, pressed: 1 | -1): -1 | 0 | 1 {
  return current === pressed ? 0 : pressed;
}

export function clampVolume(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
