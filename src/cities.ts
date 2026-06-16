export interface City {
  id: string;
  name: string;
  country: string;
  /** [lng, lat] */
  center: [number, number];
}

/** Anywhere on Earth the player has chosen to explore. */
export interface Destination {
  /** [lng, lat] */
  center: [number, number];
  name: string;
}

/**
 * Best-effort friendly name for an arbitrary point: the nearest curated city if
 * one is close enough (rough degree distance), otherwise null so the caller can
 * fall back to a coordinate label or a map-feature name.
 */
export function nearestCityName(lng: number, lat: number, maxDeg = 1.2): string | null {
  let best: City | null = null;
  let bestD = Infinity;
  for (const c of CITIES) {
    const dx = c.center[0] - lng;
    const dy = c.center[1] - lat;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best && bestD <= maxDeg ? best.name : null;
}

/** Curated set of cities with dense, interesting street networks. */
export const CITIES: City[] = [
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', center: [4.9041, 52.3676] },
  { id: 'paris', name: 'Paris', country: 'France', center: [2.3522, 48.8566] },
  { id: 'newyork', name: 'New York', country: 'USA', center: [-73.9857, 40.7484] },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', center: [139.7671, 35.6812] },
  { id: 'london', name: 'London', country: 'UK', center: [-0.1276, 51.5072] },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', center: [2.1734, 41.3851] },
  { id: 'sanfrancisco', name: 'San Francisco', country: 'USA', center: [-122.4194, 37.7749] },
  { id: 'rome', name: 'Rome', country: 'Italy', center: [12.4964, 41.9028] },
  { id: 'sydney', name: 'Sydney', country: 'Australia', center: [151.2093, -33.8688] },
  { id: 'berlin', name: 'Berlin', country: 'Germany', center: [13.405, 52.52] },
  { id: 'mumbai', name: 'Mumbai', country: 'India', center: [72.8777, 19.076] },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', center: [103.8198, 1.3521] },
];
