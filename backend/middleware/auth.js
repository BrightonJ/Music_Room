const jwt = require('jsonwebtoken');
const { logActivity } = require('../services/activityLog');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token" });
        req.user = payload;

        logActivity({
            userId: payload.userId,
            action: `${req.method} ${req.baseUrl}${req.path}`,
            platform: req.headers['x-platform'],
            deviceName: req.headers['x-device'],
            appVersion: req.headers['x-app-version'],
        });

        next();
    });
}

module.exports = { authenticateToken, JWT_SECRET };