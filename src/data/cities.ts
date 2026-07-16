// data/cities.ts

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
  // === INTERNATIONAL CITIES ===
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', center: [4.9041, 52.3676] },
  { id: 'paris', name: 'Paris', country: 'France', center: [2.3522, 48.8566] },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', center: [139.7671, 35.6812] },
  { id: 'london', name: 'London', country: 'UK', center: [-0.1276, 51.5072] },
  { id: 'barcelona', name: 'Barcelona', country: 'Spain', center: [2.1734, 41.3851] },
  { id: 'rome', name: 'Rome', country: 'Italy', center: [12.4964, 41.9028] },
  { id: 'sydney', name: 'Sydney', country: 'Australia', center: [151.2093, -33.8688] },
  { id: 'berlin', name: 'Berlin', country: 'Germany', center: [13.405, 52.52] },
  { id: 'mumbai', name: 'Mumbai', country: 'India', center: [72.8777, 19.076] },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', center: [103.8198, 1.3521] },

  // === MAJOR U.S. CITIES (Alphabetical) ===
  { id: 'atlanta', name: 'Atlanta', country: 'USA', center: [-84.3877, 33.7489] }, // Downtown
  // MLK Home (exact) is at [-84.37196, 33.75513] – we'll use this as the default below
  { id: 'austin', name: 'Austin', country: 'USA', center: [-97.7431, 30.2672] },
  { id: 'baltimore', name: 'Baltimore', country: 'USA', center: [-76.6122, 39.2904] },
  { id: 'boston', name: 'Boston', country: 'USA', center: [-71.0589, 42.3601] },
  { id: 'charlotte', name: 'Charlotte', country: 'USA', center: [-80.8431, 35.2271] },
  { id: 'chicago', name: 'Chicago', country: 'USA', center: [-87.6298, 41.8781] },
  { id: 'cleveland', name: 'Cleveland', country: 'USA', center: [-81.6944, 41.4993] },
  { id: 'columbus', name: 'Columbus', country: 'USA', center: [-83.0030, 39.9612] },
  { id: 'dallas', name: 'Dallas', country: 'USA', center: [-96.7970, 32.7767] },
  { id: 'denver', name: 'Denver', country: 'USA', center: [-104.9903, 39.7392] },
  { id: 'detroit', name: 'Detroit', country: 'USA', center: [-83.0458, 42.3314] },
  { id: 'elpaso', name: 'El Paso', country: 'USA', center: [-106.4850, 31.7619] },
  { id: 'fortworth', name: 'Fort Worth', country: 'USA', center: [-97.3308, 32.7555] },
  { id: 'fresno', name: 'Fresno', country: 'USA', center: [-119.7871, 36.7378] },
  { id: 'houston', name: 'Houston', country: 'USA', center: [-95.3698, 29.7604] },
  { id: 'indianapolis', name: 'Indianapolis', country: 'USA', center: [-86.1581, 39.7684] },
  { id: 'jacksonville', name: 'Jacksonville', country: 'USA', center: [-81.6557, 30.3322] },
  { id: 'kansascity', name: 'Kansas City', country: 'USA', center: [-94.5786, 39.0997] },
  { id: 'lasvegas', name: 'Las Vegas', country: 'USA', center: [-115.1398, 36.1699] },
  { id: 'losangeles', name: 'Los Angeles', country: 'USA', center: [-118.2437, 34.0522] },
  { id: 'louisville', name: 'Louisville', country: 'USA', center: [-85.7585, 38.2527] },
  { id: 'memphis', name: 'Memphis', country: 'USA', center: [-90.0480, 35.1495] },
  { id: 'miami', name: 'Miami', country: 'USA', center: [-80.1918, 25.7617] },
  { id: 'milwaukee', name: 'Milwaukee', country: 'USA', center: [-87.9065, 43.0389] },
  { id: 'minneapolis', name: 'Minneapolis', country: 'USA', center: [-93.2650, 44.9778] },
  { id: 'nashville', name: 'Nashville', country: 'USA', center: [-86.7816, 36.1627] },
  { id: 'neworleans', name: 'New Orleans', country: 'USA', center: [-90.0715, 29.9511] },
  { id: 'newyork', name: 'New York', country: 'USA', center: [-73.9857, 40.7484] }, // Already exists
  { id: 'oklahomacity', name: 'Oklahoma City', country: 'USA', center: [-97.5164, 35.4676] },
  { id: 'orlando', name: 'Orlando', country: 'USA', center: [-81.3792, 28.5383] },
  { id: 'philadelphia', name: 'Philadelphia', country: 'USA', center: [-75.1652, 39.9526] },
  { id: 'phoenix', name: 'Phoenix', country: 'USA', center: [-112.0740, 33.4484] },
  { id: 'pittsburgh', name: 'Pittsburgh', country: 'USA', center: [-79.9959, 40.4406] },
  { id: 'portland', name: 'Portland', country: 'USA', center: [-122.6762, 45.5152] },
  { id: 'sacramento', name: 'Sacramento', country: 'USA', center: [-121.4944, 38.5816] },
  { id: 'sanantonio', name: 'San Antonio', country: 'USA', center: [-98.4936, 29.4241] },
  { id: 'sandiego', name: 'San Diego', country: 'USA', center: [-117.1611, 32.7157] },
  { id: 'sanfrancisco', name: 'San Francisco', country: 'USA', center: [-122.4194, 37.7749] }, // Already exists
  { id: 'sanjose', name: 'San Jose', country: 'USA', center: [-121.8863, 37.3382] },
  { id: 'seattle', name: 'Seattle', country: 'USA', center: [-122.3321, 47.6062] },
  { id: 'stlouis', name: 'St. Louis', country: 'USA', center: [-90.1994, 38.6270] },
  { id: 'tampa', name: 'Tampa', country: 'USA', center: [-82.4572, 27.9506] },
  { id: 'tucson', name: 'Tucson', country: 'USA', center: [-110.9747, 32.2226] },
  { id: 'washington', name: 'Washington D.C.', country: 'USA', center: [-77.0369, 38.9072] },
];
