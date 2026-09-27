import { describe, expect, it } from '@jest/globals';
import { clampVolume, currentPositionMs, nextVoteValue } from '../playback';

describe('currentPositionMs', () => {
  const clock = { positionMs: 10000, durationMs: 30000, isPlaying: true, receivedAt: 1000 };

  it('adds the time elapsed since reception while playing', () => {
    expect(currentPositionMs(clock, 3500)).toBe(12500);
  });

  it('stays frozen while paused', () => {
    expect(currentPositionMs({ ...clock, isPlaying: false }, 99999)).toBe(10000);
  });

  it('never goes beyond the duration or below zero', () => {
    expect(currentPositionMs(clock, 1000000)).toBe(30000);
    expect(currentPositionMs({ ...clock, positionMs: -50, isPlaying: false })).toBe(0);
  });
});

describe('nextVoteValue', () => {
  it('toggles the same vote off and switches sides', () => {
    expect(nextVoteValue(undefined, 1)).toBe(1);
    expect(nextVoteValue(1, 1)).toBe(0);
    expect(nextVoteValue(1, -1)).toBe(-1);
    expect(nextVoteValue(-1, -1)).toBe(0);
  });
});

describe('clampVolume', () => {
  it('keeps the volume between 0 and 1 with two decimals', () => {
    expect(clampVolume(1.3)).toBe(1);
    expect(clampVolume(-0.2)).toBe(0);
    expect(clampVolume(0.6000001)).toBe(0.6);
  });
});
