const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/search/tracks', authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.status(200).json([]);

        const deezerResponse = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`);
        if (!deezerResponse.ok) {
            return res.status(502).json({ error: "Music search is currently unavailable" });
        }

        const deezerData = await deezerResponse.json();

        const tracks = (deezerData.data || []).map(t => ({
            deezerId: t.id,
            title: t.title,
            artist: t.artist ? t.artist.name : 'Unknown',
            coverUrl: t.album ? t.album.cover_medium : null,
            previewUrl: t.preview || null,
            durationMs: (t.duration || 30) * 1000
        }));

        res.status(200).json(tracks);
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: "Music search is currently unavailable" });
    }
});

module.exports = router;