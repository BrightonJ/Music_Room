require('dotenv').config();

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Set it in backend/.env before starting the server.");
    process.exit(1);
}

const http = require('http');
const { app, allowedOrigins } = require('./app');
const { initSocket } = require('./sockets');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server, allowedOrigins);

server.listen(PORT, () => {
    console.log(`API + WebSockets on port ${PORT}`);
});