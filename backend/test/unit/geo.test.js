const { test } = require('node:test');
const assert = require('node:assert/strict');
const { haversineDistanceMeters, isWithinWindow } = require('../../utils/geo');

test('haversine: Paris to Lyon is about 392 km', () => {
  const d = haversineDistanceMeters(48.8566, 2.3522, 45.764, 4.8357);
  assert.ok(d > 385000 && d < 400000, `got ${d}`);
});

test('haversine: same point is 0 m, 0.001 degree of latitude is about 111 m', () => {
  assert.equal(haversineDistanceMeters(48.85, 2.35, 48.85, 2.35), 0);
  const d = haversineDistanceMeters(48.85, 2.35, 48.851, 2.35);
  assert.ok(Math.abs(d - 111) < 2, `got ${d}`);
});

test('time window uses absolute instants, bounds included', () => {
  const start = new Date('2026-06-21T18:00:00Z');
  const end = new Date('2026-06-21T23:00:00Z');
  assert.equal(isWithinWindow(start, end, new Date('2026-06-21T20:00:00Z')), true);
  assert.equal(isWithinWindow(start, end, start), true);
  assert.equal(isWithinWindow(start, end, end), true);
  assert.equal(isWithinWindow(start, end, new Date('2026-06-21T17:59:59Z')), false);
  assert.equal(isWithinWindow(start, end, new Date('2026-06-22T00:00:00Z')), false);
  assert.equal(isWithinWindow(null, end), false);
});
