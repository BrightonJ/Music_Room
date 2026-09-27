const db = require('../config/db');
const { haversineDistanceMeters, isWithinWindow } = require('../utils/geo');
const { isFiniteNumberInRange } = require('../utils/validators');

// Visibility: public events are visible to everyone, private ones only to
// their owner and to the users who accepted an invitation.
async function canAccessEvent(userId, eventId) {
  const result = await db.query(
    `SELECT e.* FROM events e
     WHERE e.id = $1 AND (
       e.is_private = false OR e.owner_id = $2 OR EXISTS (
         SELECT 1 FROM event_invitations ei
         WHERE ei.event_id = e.id AND ei.user_id = $2 AND ei.status = 'accepted'))`,
    [eventId, userId]
  );
  return result.rows[0] || null;
}

async function isAcceptedInvitee(userId, eventId) {
  const result = await db.query(
    `SELECT 1 FROM event_invitations WHERE event_id = $1 AND user_id = $2 AND status = 'accepted'`,
    [eventId, userId]
  );
  return result.rows.length > 0;
}

// The owner controls the room from any of his devices. Anybody else needs a
// delegation for THIS device (event_delegations.device_id).
async function hasPlaybackControl(userId, eventId, deviceRowId) {
  const result = await db.query(
    `SELECT e.owner_id,
            EXISTS (SELECT 1 FROM event_delegations d
                    WHERE d.event_id = e.id AND d.user_id = $2 AND d.device_id = $3) AS delegated
     FROM events e WHERE e.id = $1`,
    [eventId, userId, deviceRowId || 0]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].owner_id === userId || result.rows[0].delegated;
}

// Pure function (unit tested): place + time license
function checkLocationLicense(event, lat, lng, now = new Date()) {
  if (!isWithinWindow(event.vote_starts_at, event.vote_ends_at, now)) {
    return { allowed: false, reason: 'Voting is only open during the event time window' };
  }
  if (event.location_lat == null || event.location_lng == null) {
    return { allowed: false, reason: 'Event location is not configured' };
  }
  if (!isFiniteNumberInRange(lat, -90, 90) || !isFiniteNumberInRange(lng, -180, 180)) {
    return { allowed: false, reason: 'Your location is required to vote in this room' };
  }
  const distance = haversineDistanceMeters(event.location_lat, event.location_lng, lat, lng);
  if (distance > (event.location_radius_m || 100)) {
    return { allowed: false, reason: 'You must be at the event location to vote' };
  }
  return { allowed: true };
}

// Vote license (subject V.2.1). The host can always vote in his own room.
async function evaluateVoteLicense(event, userId, lat, lng) {
  if (event.owner_id === userId) return { allowed: true };
  switch (event.vote_license) {
    case 'invited':
      return (await isAcceptedInvitee(userId, event.id))
        ? { allowed: true }
        : { allowed: false, reason: 'Only invited guests can vote in this room' };
    case 'location':
      return checkLocationLicense(event, lat, lng);
    default:
      return { allowed: true };
  }
}

module.exports = { canAccessEvent, isAcceptedInvitee, hasPlaybackControl, checkLocationLicense, evaluateVoteLicense };
