function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Absolute instants (TIMESTAMPTZ): no dependency on the server time zone
function isWithinWindow(startsAt, endsAt, now = new Date()) {
  if (!startsAt || !endsAt) return false;
  const t = now.getTime();
  return t >= new Date(startsAt).getTime() && t <= new Date(endsAt).getTime();
}

module.exports = { haversineDistanceMeters, isWithinWindow };
