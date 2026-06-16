import type { Map as MlMap } from 'maplibre-gl';

/**
 * Generous half-corridor width (metres) per road class. Keys cover both the
 * OpenMapTiles `class` values (motorway/trunk/primary/secondary/tertiary/minor/
 * service) and raw OSM highway values, so we work regardless of schema quirks.
 * Anything not listed (footway, path, track, rail, ferry…) is not drivable.
 */
const HALF_WIDTH: Record<string, number> = {
  motorway: 16,
  trunk: 14,
  primary: 12,
  secondary: 10,
  tertiary: 9,
  minor: 8,
  service: 6,
  motorway_link: 11,
  trunk_link: 10,
  primary_link: 9,
  secondary_link: 8,
  tertiary_link: 7,
  residential: 8,
  living_street: 7,
  unclassified: 8,
  road: 8,
  busway: 8,
  bridge: 8, // road-carrying bridge structures (common over canals/rivers)
};

const M_PER_DEG_LAT = 111_320;
/** Re-query the vector tiles once the car has moved this far from the last query. */
const REFRESH_DIST = 25;

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
}

function ptSegPoint(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { d: Math.hypot(px - x, py - y), x, y };
}

/**
 * A local snapshot of drivable roads near the car, built from MapLibre's loaded
 * vector tiles. Geometry is projected into a flat metre frame anchored at the
 * last refresh point so distance maths is cheap and accurate over the small
 * area we care about.
 */
export class RoadNetwork {
  private segs: Seg[] = [];
  private originLng = 0;
  private originLat = 0;
  private mLng = M_PER_DEG_LAT;
  private mLat = M_PER_DEG_LAT;
  private refLng = NaN;
  private refLat = NaN;
  private srcId: string | null = null;

  hasData() {
    return this.segs.length > 0;
  }

  private setOrigin(lng: number, lat: number) {
    this.originLng = lng;
    this.originLat = lat;
    this.mLat = M_PER_DEG_LAT;
    this.mLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  }

  private lx(lng: number) {
    return (lng - this.originLng) * this.mLng;
  }
  private ly(lat: number) {
    return (lat - this.originLat) * this.mLat;
  }

  /** Re-query roads if the car has wandered far from the last refresh point. */
  maybeRefresh(map: MlMap, lng: number, lat: number) {
    const far =
      Number.isNaN(this.refLng) ||
      Math.hypot((lng - this.refLng) * this.mLng, (lat - this.refLat) * this.mLat) > REFRESH_DIST;
    if (!far && this.segs.length) return;
    this.refresh(map, lng, lat);
  }

  refresh(map: MlMap, lng: number, lat: number) {
    if (!this.srcId) {
      const sources = map.getStyle()?.sources ?? {};
      this.srcId =
        Object.keys(sources).find((id) => (sources as Record<string, { type: string }>)[id].type === 'vector') ??
        null;
    }
    if (!this.srcId) return;

    let feats;
    try {
      feats = map.querySourceFeatures(this.srcId, { sourceLayer: 'transportation' });
    } catch {
      return;
    }
    this.refLng = lng;
    this.refLat = lat;
    if (!feats || !feats.length) return; // tiles not loaded yet — keep any prior segments

    this.setOrigin(lng, lat);
    const segs: Seg[] = [];
    for (const f of feats) {
      const cls = f.properties?.class as string | undefined;
      const half = cls ? HALF_WIDTH[cls] : undefined;
      if (!half) continue;
      const g = f.geometry;
      const lines =
        g.type === 'LineString'
          ? [g.coordinates]
          : g.type === 'MultiLineString'
            ? g.coordinates
            : [];
      for (const line of lines) {
        for (let i = 0; i + 1 < line.length; i++) {
          const a = line[i];
          const b = line[i + 1];
          segs.push({ ax: this.lx(a[0]), ay: this.ly(a[1]), bx: this.lx(b[0]), by: this.ly(b[1]), half });
        }
      }
    }
    if (segs.length) this.segs = segs;
  }

  /** True if the point lies within the corridor of some drivable road. */
  isOnRoad(lng: number, lat: number, carHalf = 1.4) {
    if (!this.segs.length) return true; // unknown → don't trap the car
    const px = this.lx(lng);
    const py = this.ly(lat);
    let best = Infinity;
    let bestHalf = 0;
    for (const s of this.segs) {
      const d = ptSegPoint(px, py, s.ax, s.ay, s.bx, s.by).d;
      if (d < best) {
        best = d;
        bestHalf = s.half;
      }
    }
    return best <= bestHalf + carHalf;
  }

  /** Nearest point on the network + the road's bearing there (heading, radians
   * clockwise from north). Null if no road data is loaded yet. */
  snap(lng: number, lat: number): { lng: number; lat: number; heading: number } | null {
    if (!this.segs.length) return null;
    const px = this.lx(lng);
    const py = this.ly(lat);
    let best = Infinity;
    let bx = 0;
    let by = 0;
    let seg: Seg | null = null;
    for (const s of this.segs) {
      const r = ptSegPoint(px, py, s.ax, s.ay, s.bx, s.by);
      if (r.d < best) {
        best = r.d;
        bx = r.x;
        by = r.y;
        seg = s;
      }
    }
    if (!seg) return null;
    return {
      lng: this.originLng + bx / this.mLng,
      lat: this.originLat + by / this.mLat,
      heading: Math.atan2(seg.bx - seg.ax, seg.by - seg.ay),
    };
  }
}
