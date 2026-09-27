const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../../utils/validators');

test('parseId accepts positive 32-bit integers only', () => {
  assert.equal(v.parseId('42'), 42);
  assert.equal(v.parseId(7), 7);
  for (const bad of ['0', '-1', '1.5', 'abc', '1e3', '', null, undefined, '99999999999', ' 3']) {
    assert.equal(v.parseId(bad), null, `should reject ${bad}`);
  }
});

test('birth dates must be real calendar dates between 1900 and today', () => {
  assert.equal(v.isValidBirthDate('2000-01-15'), true);
  assert.equal(v.isValidBirthDate('2000-02-30'), false);
  assert.equal(v.isValidBirthDate('1899-12-31'), false);
  assert.equal(v.isValidBirthDate('3000-01-01'), false);
  assert.equal(v.isValidBirthDate('15/01/2000'), false);
  assert.equal(v.isValidBirthDate(20000115), false);
});

test('password policy', () => {
  assert.equal(v.passwordRegex.test('Passw0rd!'), true);
  assert.equal(v.passwordRegex.test('password'), false);
  assert.equal(v.passwordRegex.test('Sh0rt!'), false);
  assert.equal(v.passwordRegex.test('NoDigits!!'), false);
});

test('usernames, emails and device ids', () => {
  assert.equal(v.usernameRegex.test('jen_42'), true);
  assert.equal(v.usernameRegex.test('ab'), false);
  assert.equal(v.usernameRegex.test("x' OR 1=1"), false);
  assert.equal(v.emailRegex.test('a@b.fr'), true);
  assert.equal(v.emailRegex.test('a@b'), false);
  assert.equal(v.deviceUidRegex.test('3f2b8c4e-0a1d-4c55-9e7b-2c1f0d9a8b7c'), true);
  assert.equal(v.deviceUidRegex.test('short'), false);
  assert.equal(v.normalizeEmail('  Jen@Mail.FR '), 'jen@mail.fr');
});

test('cleanString and number ranges', () => {
  assert.equal(v.cleanString('  Party  ', 10), 'Party');
  assert.equal(v.cleanString('   ', 10), null);
  assert.equal(v.cleanString('x'.repeat(11), 10), null);
  assert.equal(v.cleanString(12, 10), null);
  assert.equal(v.isFiniteNumberInRange(48.8, -90, 90), true);
  assert.equal(v.isFiniteNumberInRange(NaN, -90, 90), false);
  assert.equal(v.isFiniteNumberInRange('48.8', -90, 90), false);
  assert.ok(v.parseDateTime('2026-06-21T18:00:00.000Z') instanceof Date);
  assert.equal(v.parseDateTime('not a date'), null);
});
