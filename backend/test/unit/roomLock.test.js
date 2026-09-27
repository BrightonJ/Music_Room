const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withRoomLock } = require('../../sockets/roomLock');
const { createTokenBucket } = require('../../utils/tokenBucket');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('operations on the same room never interleave and keep their order', async () => {
  const trace = [];
  const op = (name, ms) => withRoomLock(1, async () => {
    trace.push(`${name}:start`);
    await sleep(ms);
    trace.push(`${name}:end`);
  });
  await Promise.all([op('a', 30), op('b', 5), op('c', 1)]);
  assert.deepEqual(trace, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
});

test('different rooms run in parallel', async () => {
  const trace = [];
  await Promise.all([
    withRoomLock(10, async () => { trace.push('x:start'); await sleep(20); trace.push('x:end'); }),
    withRoomLock(11, async () => { trace.push('y:start'); await sleep(1); trace.push('y:end'); }),
  ]);
  assert.deepEqual(trace, ['x:start', 'y:start', 'y:end', 'x:end']);
});

test('a failing operation rejects its caller but does not block the room', async () => {
  await assert.rejects(withRoomLock(2, async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await withRoomLock(2, async () => 'next'), 'next');
});

test('token bucket: burst then refill', async () => {
  const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 100 });
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), false);
  await sleep(30);
  assert.equal(bucket.take(), true);
  const disabled = createTokenBucket({ capacity: 1, refillPerSecond: 0, enabled: false });
  for (let i = 0; i < 5; i++) assert.equal(disabled.take(), true);
});
