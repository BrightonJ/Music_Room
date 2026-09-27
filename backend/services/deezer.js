// Deezer is only the music catalog. The client sends a Deezer id; the server
// fetches title, cover, duration and a FRESH preview URL itself, so a client
// can never inject arbitrary URLs or durations into a room.
const DEEZER_API = 'https://api.deezer.com';
const PREVIEW_MAX_MS = 30000; // previews contain the first 30 seconds of a track
const TIMEOUT_MS = 5000;

class DeezerError extends Error {}

async function deezerGet(path) {
  let response;
  try {
    response = await fetch(`${DEEZER_API}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new DeezerError(`Deezer unreachable: ${err.message}`);
  }
  if (!response.ok) throw new DeezerError(`Deezer HTTP ${response.status}`);
  const data = await response.json();
  if (data && data.error) throw new DeezerError(data.error.message || 'Deezer error');
  return data;
}

function mapTrack(raw) {
  if (!raw || !raw.id || !raw.preview || raw.readable === false) return null;
  const seconds = Number(raw.duration) > 0 ? Number(raw.duration) : 30;
  return {
    deezerId: Number(raw.id),
    title: String(raw.title || 'Unknown title').slice(0, 255),
    artist: String((raw.artist && raw.artist.name) || 'Unknown artist').slice(0, 255),
    coverUrl: raw.album && raw.album.cover_medium ? String(raw.album.cover_medium).slice(0, 500) : null,
    previewUrl: String(raw.preview),
    // What is actually played is the preview, not the full track
    durationMs: Math.min(seconds * 1000, PREVIEW_MAX_MS),
  };
}

async function searchTracks(query) {
  const data = await deezerGet(`/search?q=${encodeURIComponent(query)}&limit=15`);
  return (data.data || [])
    .map(mapTrack)
    .filter(Boolean)
    .map(({ previewUrl, ...track }) => track); // preview URLs expire: never hand them out here
}

async function getTrack(deezerId) {
  return mapTrack(await deezerGet(`/track/${Number(deezerId)}`));
}

module.exports = { searchTracks, getTrack, DeezerError, PREVIEW_MAX_MS };
