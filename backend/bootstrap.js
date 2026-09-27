const http = require('http');
const { app } = require('./app');
const { initSocket } = require('./sockets');
const playback = require('./sockets/playback');

// Starts the HTTP + Socket.IO server. Used by server.js and by the integration tests.
function start({ port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0', restore = true } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    const io = initSocket(server);
    server.once('error', reject);
    server.listen(port, host, async () => {
      if (restore) {
        try {
          const restored = await playback.restoreAll();
          if (restored) console.log(`▶️  Resumed playback in ${restored} room(s)`);
        } catch (err) {
          console.error('Could not restore playback:', err);
        }
      }
      const close = () =>
        new Promise((done) => {
          playback.stopAll();
          server.closeAllConnections();
          io.close(() => done());
        });
      resolve({ server, io, port: server.address().port, close });
    });
  });
}

module.exports = { start };
