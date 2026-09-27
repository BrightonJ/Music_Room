const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { parseId } = require('../utils/validators');

const router = express.Router();

router.get('/invitations', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT ei.id, ei.event_id, e.name AS event_name, u.username AS invited_by_username
     FROM event_invitations ei
     JOIN events e ON e.id = ei.event_id
     LEFT JOIN users u ON u.id = ei.invited_by
     WHERE ei.user_id = $1 AND ei.status = 'pending'
     ORDER BY ei.created_at DESC`,
    [req.user.userId]
  );
  res.json(result.rows);
});

router.post('/invitations/:id/accept', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Invitation not found', 404);
  const result = await db.query(
    `UPDATE event_invitations SET status = 'accepted' WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING *`,
    [id, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Invitation not found', 404);
  res.json(result.rows[0]);
});

router.post('/invitations/:id/decline', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Invitation not found', 404);
  const result = await db.query(
    `DELETE FROM event_invitations WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
    [id, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Invitation not found', 404);
  res.json({ message: 'Invitation declined' });
});

module.exports = router;
