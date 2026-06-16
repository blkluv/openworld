# 🌍 OpenWorld

Spin a 3D globe, click a city, and ride a bicycle through its real streets in
third person — all from free, open map data with **no API keys**.

## What it does

1. **Globe** — an interactive 3D Earth (MapLibre globe projection) with curated
   city markers. Drag to spin, scroll to zoom.
2. **Drill in** — click a city marker to fly down into its real geography.
3. **Ride** — a third-person cyclist you steer freely with the keyboard, over
   the city's actual street layout and stylized 3D buildings.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Pedal forward |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `← →` | Steer |

## Tech

- **React + Vite + TypeScript**
- **[MapLibre GL JS](https://maplibre.org)** — globe projection + 3D building
  extrusions, all client-side.
- **[OpenFreeMap](https://openfreemap.org)** — free, key-less vector tiles
  (OpenStreetMap data).
- **[three.js](https://threejs.org)** — the cyclist, rendered through a MapLibre
  *custom layer* so it shares the map's WebGL camera and stays locked to
  real-world coordinates while the map draws the world beneath it.

### How the avatar stays on the map

The cyclist isn't a separate 3D scene floating over the map. `AvatarLayer`
([src/lib/avatarLayer.ts](src/lib/avatarLayer.ts)) is a MapLibre custom layer:
each frame it reads the bike's live `lng/lat/heading` from the
[`BikeController`](src/lib/BikeController.ts), builds the mercator model matrix,
and renders the three.js cyclist into MapLibre's own camera. The controller runs
the physics loop and drives the map camera to follow behind the rider.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
```

## Ideas / next steps

- Snap movement to the OSM road graph (currently free-roam).
- Real cyclist GLTF model + pedalling animation.
- Mini-map, photo mode, day/night lighting.
- Deep-link straight into a city (a dev hook for this already exists:
  `window.__ride('amsterdam')`).
