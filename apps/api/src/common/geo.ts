// Small bundled static reference dataset for city -> coordinates (§9.8: no external mapping
// API call). Only covers the cities the Telemetry Generator's templates.ts can produce.
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  Chicago: { lat: 41.8781, lon: -87.6298 },
  Toronto: { lat: 43.6511, lon: -79.3832 },
  London: { lat: 51.5072, lon: -0.1276 },
  Berlin: { lat: 52.52, lon: 13.405 },
  Sydney: { lat: -33.8688, lon: 151.2093 },
  Paris: { lat: 48.8566, lon: 2.3522 },
  Tokyo: { lat: 35.6762, lon: 139.6503 },
  Singapore: { lat: 1.3521, lon: 103.8198 },
  'Mexico City': { lat: 19.4326, lon: -99.1332 },
  Bucharest: { lat: 44.4268, lon: 26.1025 },
  Hanoi: { lat: 21.0278, lon: 105.8342 },
  Lagos: { lat: 6.5244, lon: 3.3792 },
};

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceBetweenCitiesKm(
  cityA: string,
  cityB: string,
): number | null {
  const a = CITY_COORDINATES[cityA];
  const b = CITY_COORDINATES[cityB];
  if (!a || !b) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

/** §9.6: implied travel speed between two consecutive sign-ins, for impossible-travel reasoning. */
export function impliedTravelSpeedKmh(
  distanceKm: number,
  minutesElapsed: number,
): number | null {
  if (minutesElapsed <= 0) return null;
  return distanceKm / (minutesElapsed / 60);
}
