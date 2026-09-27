const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filterProfileForViewer } = require('../../models/profiles');

const user = {
  id: 1,
  username: 'jen',
  first_name: 'Jennifer',
  last_name: 'Ubaldo',
  birth_date: '2000-01-15',
  music_preferences: ['jazz'],
  privacy_settings: { first_name: 'public', last_name: 'friends', birth_date: 'private', music_preferences: 'friends' },
};

test('a stranger only sees public fields', () => {
  assert.deepEqual(filterProfileForViewer(user, false, false), { id: 1, username: 'jen', first_name: 'Jennifer' });
});

test('a friend sees public and friends fields', () => {
  const p = filterProfileForViewer(user, false, true);
  assert.equal(p.last_name, 'Ubaldo');
  assert.deepEqual(p.music_preferences, ['jazz']);
  assert.equal(p.birth_date, undefined);
});

test('the user sees everything, unknown settings default to private', () => {
  assert.equal(filterProfileForViewer(user, true, false).birth_date, '2000-01-15');
  const p = filterProfileForViewer({ ...user, privacy_settings: {} }, false, true);
  assert.equal(p.first_name, undefined);
});
