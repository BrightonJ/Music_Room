const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ClientError } = require('../utils/errors');
const { parseId } = require('../utils/validators');
const { notifyUsers } = require('../sockets/ioState');

// Tells the host (invite screen) and the guest's other devices (rooms list)
async function invitationAnswered(invitation, reason) {
  const info = await db.query(
    'SELECT e.owner_id, e.name, u.username FROM events e JOIN users u ON u.id = $2 WHERE e.id = $1',
    [invitation.event_id, invitation.user_id]
  );
  if (info.rows.length === 0) return;
  const { owner_id: ownerId, name, username } = info.rows[0];
  notifyUsers([ownerId, invitation.user_id], 'invitations_changed', {
    reason,
    eventId: invitation.event_id,
    eventName: name,
    username,
    userId: invitation.user_id,
  });
}

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
  await invitationAnswered(result.rows[0], 'accepted');
  res.json(result.rows[0]);
});

router.post('/invitations/:id/decline', requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new ClientError('Invitation not found', 404);
  const result = await db.query(
    `DELETE FROM event_invitations WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id, event_id, user_id`,
    [id, req.user.userId]
  );
  if (result.rows.length === 0) throw new ClientError('Invitation not found', 404);
  await invitationAnswered(result.rows[0], 'declined');
  res.json({ message: 'Invitation declined' });
});

module.exports = router;
