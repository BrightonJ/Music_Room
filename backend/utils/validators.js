const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
const passwordRequirementMessage = 'Password must be 8 to 128 characters and include an uppercase letter, a lowercase letter, a digit and a special character';
const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
const deviceUidRegex = /^[A-Za-z0-9-]{8,64}$/;
const privacyLevels = ['public', 'friends', 'private'];
const editableProfileFields = ['first_name', 'last_name', 'birth_date', 'music_preferences'];
const VOTE_LICENSES = ['everyone', 'invited', 'location'];

// Positive 32-bit integer id, or null
function parseId(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Trimmed non-empty string of at most `max` characters, or null
function cleanString(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function isFiniteNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseDateTime(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 'YYYY-MM-DD', a real calendar date, between 1900 and today
function isValidBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid && y >= 1900 && date.getTime() <= Date.now();
}

module.exports = {
  emailRegex,
  passwordRegex,
  passwordRequirementMessage,
  usernameRegex,
  deviceUidRegex,
  privacyLevels,
  editableProfileFields,
  VOTE_LICENSES,
  parseId,
  normalizeEmail,
  cleanString,
  isFiniteNumberInRange,
  parseDateTime,
  isValidBirthDate,
};
