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

module.exports = { setIO, getIO, roomName, socketsInRoom, disconnectDevice, disconnectUser };
