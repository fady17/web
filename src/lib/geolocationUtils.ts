// src/lib/geolocationUtils.ts
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the Haversine distance between two points on the Earth.
 * @param coords1 - The first coordinates { latitude, longitude }.
 * @param coords2 - The second coordinates { latitude, longitude }.
 * @returns The distance in kilometers.
 */
export function haversineDistance(coords1: Coordinates, coords2: Coordinates): number {
  const R = 6371; // Radius of the Earth in kilometers

  const dLat = toRadians(coords2.latitude - coords1.latitude);
  const dLon = toRadians(coords2.longitude - coords1.longitude);

  const lat1Rad = toRadians(coords1.latitude);
  const lat2Rad = toRadians(coords2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}