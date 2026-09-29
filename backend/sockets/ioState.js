let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  return ioInstance;
}

// Prefixed so a room name can never collide with a socket id
function roomName(eventId) {
  return `event:${eventId}`;
}

// Personal channel: every socket of a user (all their devices) joins it on connection
function userRoomName(userId) {
  return `user:${userId}`;
}

// Real-time notification to every connected device of these users. Fire and forget:
// the REST answer never waits for it, and a user who is offline simply refreshes later.
function notifyUsers(userIds, event, payload) {
  if (!ioInstance) return;
  for (const userId of new Set(userIds)) ioInstance.to(userRoomName(userId)).emit(event, payload);
}

// Real-time notification to every connected user (e.g. a new public room)
function notifyAll(event, payload) {
  if (ioInstance) ioInstance.emit(event, payload);
}

async function socketsInRoom(eventId) {
  if (!ioInstance) return [];
  return ioInstance.in(roomName(eventId)).fetchSockets();
}

async function disconnectWhere(predicate) {
  if (!ioInstance) return;
  const sockets = await ioInstance.fetchSockets();
  sockets.filter((s) => predicate(s.data || {})).forEach((s) => s.disconnect(true));
}

// Used when a device is removed / logged out, or all sessions are revoked
const disconnectDevice = (deviceId) => disconnectWhere((d) => d.deviceRowId === deviceId);
const disconnectUser = (userId) => disconnectWhere((d) => d.userId === userId);

module.exports = { setIO, getIO, roomName, userRoomName, notifyUsers, notifyAll, socketsInRoom, disconnectDevice, disconnectUser };
