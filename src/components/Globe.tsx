import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { nearestCityName, type Destination } from '../data/cities';
import { STYLE_URL } from '../lib/style';

interface Props {
  onSelect: (dest: Destination) => void;
}

type GeoStatus = 'idle' | 'asking' | 'denied' | 'unavailable';

/** Resolve a friendly name for a clicked point: a labelled place feature under
 * the cursor, else the nearest curated city, else the raw coordinates. */
function resolveName(map: maplibregl.Map, e: maplibregl.MapMouseEvent): string {
  const { x, y } = e.point;
  const box: [maplibregl.PointLike, maplibregl.PointLike] = [
    [x - 40, y - 40],
    [x + 40, y + 40],
  ];
  const feats = map.queryRenderedFeatures(box);
  const place = feats.find(
    (f) => f.sourceLayer === 'place' && typeof f.properties?.name === 'string',
  );
  if (place) return String(place.properties!.name);

  const { lng, lat } = e.lngLat;
  return nearestCityName(lng, lat) ?? `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export default function Globe({ onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onSelect);
  cb.current = onSelect;
  const [geo, setGeo] = useState<GeoStatus>('idle');

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        cb.current({ center: [lng, lat], name: nearestCityName(lng, lat) ?? 'My location' });
      },
      () => setGeo('denied'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  // Ask for location on first load — if granted, drive straight from there.
  useEffect(() => {
    useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: [10, 25],
      zoom: 1.6,
      attributionControl: { compact: true },
    });

    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __globe?: unknown;
        __ride?: (lng: number, lat: number, name?: string) => void;
      };
      w.__globe = map;
      w.__ride = (lng, lat, name = 'Test City') => cb.current({ center: [lng, lat], name });
    }

    map.on('style.load', () => {
      map.resize();
      map.setProjection({ type: 'globe' });

      const slowSpin = () => {
        if (map.isMoving()) return;
        const c = map.getCenter();
        map.easeTo({ center: [c.lng + 0.4, c.lat], duration: 1000, easing: (t) => t });
      };
      const spinTimer = setInterval(slowSpin, 1000);
      map.once('mousedown', () => clearInterval(spinTimer));
    });

    map.getCanvas().style.cursor = 'crosshair';

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      cb.current({ center: [lng, lat], name: resolveName(map, e) });
    });

    return () => map.remove();
  }, []);

  return (
    <div className="view">
      <div ref={ref} className="map" />
      <div className="hud hud-top">
        <h1>🌍 OpenWorld</h1>
        <p>Drag to spin · scroll to zoom · click anywhere on Earth to drive its streets</p>
      </div>

      <button className="locate-btn" onClick={useMyLocation} disabled={geo === 'asking'}>
        {geo === 'asking'
          ? 'Locating…'
          : geo === 'denied'
            ? '📍 Location blocked — click the globe'
            : geo === 'unavailable'
              ? '📍 Location unavailable'
              : '📍 Drive from my location'}
      </button>
    </div>
  );
}
