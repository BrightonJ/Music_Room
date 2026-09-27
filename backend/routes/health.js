const express = require('express');

const router = express.Router();

// Used by the app's server settings screen to test the configured address
router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'music-room', time: new Date().toISOString() });
});

module.exports = router;
