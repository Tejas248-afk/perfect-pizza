const toRad = value => (value * Math.PI) / 180;

/**
 * Haversine distance between two coords in KM
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // earth radius

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Number.isFinite(distance) ? distance : 0;
}

module.exports = { calculateDistanceKm };