const express = require('express');
const { requireAuth } = require('../middleware/auth');
const deezer = require('../services/deezer');
const { ClientError } = require('../utils/errors');

const router = express.Router();

router.get('/search/tracks', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) return res.json([]);
  if (q.length > 100) throw new ClientError('Search is too long');
  try {
    res.json(await deezer.searchTracks(q));
  } catch (err) {
    console.error('Deezer search failed:', err.message);
    throw new ClientError('Music search is currently unavailable', 502);
  }
});

module.exports = router;
