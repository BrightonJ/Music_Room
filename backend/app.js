const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { globalLimiter } = require('./utils/rateLimiters');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const invitationRoutes = require('./routes/invitations');
const friendRoutes = require('./routes/friends');
const profileRoutes = require('./routes/profile');
const searchRoutes = require('./routes/search');
const deviceRoutes = require('./routes/devices');

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

const app = express();

app.use(helmet());
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(globalLimiter);

app.use('/api', authRoutes);
app.use('/api', eventRoutes);
app.use('/api', invitationRoutes);
app.use('/api', friendRoutes);
app.use('/api', profileRoutes);
app.use('/api', searchRoutes);
app.use('/api', deviceRoutes);

module.exports = { app, allowedOrigins };