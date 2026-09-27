const db = require('../config/db');

async function areFriends(userIdA, userIdB) {
  const result = await db.query(
    `SELECT 1 FROM friendships WHERE status = 'accepted' AND
     ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [userIdA, userIdB]
  );
  return result.rows.length > 0;
}

// Each profile field has its own visibility: public / friends / private
function filterProfileForViewer(user, isSelf, isFriend) {
  const settings = user.privacy_settings || {};
  const visible = { id: user.id, username: user.username };
  const fields = {
    first_name: user.first_name,
    last_name: user.last_name,
    birth_date: user.birth_date,
    music_preferences: user.music_preferences,
  };
  for (const field of Object.keys(fields)) {
    const level = settings[field] || 'private';
    if (isSelf || level === 'public' || (level === 'friends' && isFriend)) visible[field] = fields[field];
  }
  return visible;
}

module.exports = { areFriends, filterProfileForViewer };
