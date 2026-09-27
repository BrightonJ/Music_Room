// Serializes every mutation of a room (votes, additions, playback changes,
// member list broadcasts). Node is single-threaded but every handler awaits the
// database several times: without this, two handlers interleave and a stale
// state can be broadcast last, or playNext can run twice at the same time.
//
// NEVER call withRoomLock for a room from inside a function already running
// under the lock of the same room: it would wait for itself.
const chains = new Map();

function withRoomLock(eventId, fn) {
  const key = String(eventId);
  const previous = chains.get(key) || Promise.resolve();
  const run = previous.then(() => fn());
  const tail = run.catch(() => {});
  chains.set(key, tail);
  tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return run;
}

module.exports = { withRoomLock };
