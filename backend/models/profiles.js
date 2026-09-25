const db = require('../config/db');

async function areFriends(userIdA, userIdB) {
    const result = await db.query(
        `SELECT id FROM friendships WHERE status = 'accepted' AND
         ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [userIdA, userIdB]
    );
    return result.rows.length > 0;
}

function filterProfileForViewer(user, isSelf, isFriend) {
    const settings = user.privacy_settings || {};
    const visible = { id: user.id, username: user.username };

    const fieldMap = {
        first_name: user.first_name,
        last_name: user.last_name,
        birth_date: user.birth_date,
        music_preferences: user.music_preferences
    };

    for (const field of Object.keys(fieldMap)) {
        const level = settings[field] || 'private';
        const canSee = isSelf || level === 'public' || (level === 'friends' && isFriend);
        if (canSee) visible[field] = fieldMap[field];
    }

    return visible;
}

module.exports = { areFriends, filterProfileForViewer };