const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkLocationLicense } = require('../../models/events');

const event = {
  vote_license: 'location',
  location_lat: 48.8966,
  location_lng: 2.3185, // 42 Paris
  location_radius_m: 150,
  vote_starts_at: new Date('2026-06-21T18:00:00Z'),
  vote_ends_at: new Date('2026-06-21T23:00:00Z'),
};
const during = new Date('2026-06-21T20:00:00Z');

test('on site during the window: allowed', () => {
  assert.deepEqual(checkLocationLicense(event, 48.8970, 2.3190, during), { allowed: true });
});

test('too far: refused', () => {
  const r = checkLocationLicense(event, 48.8566, 2.3522, during);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /location/);
});

test('outside the time window: refused even on site', () => {
  const r = checkLocationLicense(event, 48.8966, 2.3185, new Date('2026-06-22T08:00:00Z'));
  assert.equal(r.allowed, false);
  assert.match(r.reason, /time window/);
});

test('missing or invalid coordinates: refused', () => {
  assert.equal(checkLocationLicense(event, undefined, undefined, during).allowed, false);
  assert.equal(checkLocationLicense(event, '48.89', '2.31', during).allowed, false);
  assert.equal(checkLocationLicense(event, 123, 2.31, during).allowed, false);
});
