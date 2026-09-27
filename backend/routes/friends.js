const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { parseId, usernameRegex } = require('../utils/validators');
const { broadcastRoomMembers } = require('../sockets/presence');

const router = express.Router();

router.get('/users/search', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2 || q.length > 20) return res.json([]);
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`; // % and _ are searched literally
  const result = await db.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 ESCAPE '\\' AND id <> $2 ORDER BY username LIMIT 10`,
    [pattern, req.user.userId]
  );
  res.json(result.rows);
});

router.post('/friends/requests', requireAuth, async (req, res) => {
  const username = req.body && req.body.username;
  if (typeof username !== 'string' || !usernameRegex.test(username)) throw new ClientError('Username required');
  const target = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (target.rows.length === 0) throw new ClientError('User not found', 404);
  const me = req.user.userId;
  const other = target.rows[0].id;
  if (other === me) throw new ClientError('You cannot add yourself');

  const existing = await db.query(
    `SELECT id, requester_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [me, other]
  );
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.status === 'accepted') throw new ClientError('You are already friends', 409);
    if (row.requester_id === me) throw new ClientError('Friend request already sent', 409);
    // They already asked me: adding them back accepts their request
    const accepted = await db.query(`UPDATE friendships SET status = 'accepted' WHERE id = $1 RETURNING *`, [row.id]);
    return res.json({ ...accepted.rows[0], autoAccepted: true });
  }

  // The unique index on the (unordered) pair settles two simultaneous requests
  const result = await db.query(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')
     ON CONFLICT DO NOTHING RETURNING *`,
    [me, other]
  );
  if (result.rows.length === 0) throw new ClientError('Friend request already exists', 409);
  res.status(201).json(result.rows[0]);
});

router.get('/friends/requests', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT f.id, f.created_at, u.id AS requester_id, u.username AS requester_username
     FROM friendships f JOIN users u ON u.id = f.requester_id
     WHERE f.addressee_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [req.user.userId]
  );
  res.json(result.rows);
});

router.post('/friends/requests/:id/accept', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Request not found', 404);
  const result = await db.query(
    `UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING *`,
    [id, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Request not found', 404);
  res.json(result.rows[0]);
});

router.post('/friends/requests/:id/decline', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Request not found', 404);
  const result = await db.query(
    `DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING id`,
    [id, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Request not found', 404);
  res.json({ message: 'Request declined' });
});

router.get('/friends', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT u.id, u.username FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.username ASC`,
    [req.user.userId]
  );
  res.json(result.rows);
});

// Removing a friend also removes the room controls delegated between the two
router.delete('/friends/:userId', requireAuth, async (req, res) => {
  const other = parseId(req.params.userId);
  if (!other) throw new ClientError('Friend not found', 404);
  const me = req.user.userId;
  const client = await db.connect();
  let affectedEvents = [];
  try {
    await client.query('BEGIN');
    const removed = await client.query(
      `DELETE FROM friendships WHERE status = 'accepted' AND
       ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)) RETURNING id`,
      [me, other]
    );
    if (removed.rows.length === 0) throw new ClientError('Friend not found', 404);
    const delegations = await client.query(
      `DELETE FROM event_delegations ed USING events e
       WHERE ed.event_id = e.id AND ((e.owner_id = $1 AND ed.user_id = $2) OR (e.owner_id = $2 AND ed.user_id = $1))
       RETURNING ed.event_id`,
      [me, other]
    );
    affectedEvents = [...new Set(delegations.rows.map((r) => r.event_id))];
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  for (const eventId of affectedEvents) broadcastRoomMembers(eventId).catch((err) => console.error(err));
  res.json({ message: 'Friend removed' });
});

module.exports = router;
