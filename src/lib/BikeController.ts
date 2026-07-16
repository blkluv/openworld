import type { Map as MlMap } from 'maplibre-gl';
import { RIDE_PITCH, RIDE_ZOOM } from './style';
import { RoadNetwork } from './roads';
import { EngineSound } from './EngineSound'; // ✅ fixed

export interface BikeState {
  lng: number;
  lat: number;
  /** radians, clockwise from north */
  heading: number;
  /** metres / second along heading */
  speed: number;
}

export const MAX_SPEED = 28; // m/s (~100 km/h)
const MAX_REVERSE = 6; // m/s
const ACCEL = 9; // m/s^2
const BRAKE = 22;
const DRAG = 3.5;
const TURN_RATE = 1.9; // rad/s at full lock (low speed)
const M_PER_DEG_LAT = 111_320;
const LOOK_AHEAD_M = 16; // keep the car in the lower third of the screen

const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

/**
 * Owns the car's state + physics, listens to the keyboard, keeps the car on the
 * road network, drives the engine sound, and follows it with the camera each
 * animation frame.
 */
export class BikeController {
  state: BikeState;
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private map: MlMap;
  private onMove?: (s: BikeState) => void;
  private road = new RoadNetwork();
  private engine = new EngineSound();
  private snapped = false;

  constructor(map: MlMap, start: [number, number], onMove?: (s: BikeState) => void) {
    this.map = map;
    this.onMove = onMove;
    this.state = { lng: start[0], lat: start[1], heading: 0, speed: 0 };
  }

  /** Mute / unmute the engine sound (unmuting also starts the audio). */
  setSoundEnabled(on: boolean) {
    this.engine.setEnabled(on);
  }

  start() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.last = performance.now();
    this.loop(this.last);
  }

  stop() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(this.raf);
    this.keys.clear();
    this.engine.stop();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    this.keys.add(k);
    // Audio can only start from a user gesture.
    if (this.has('w', 'arrowup', 's', 'arrowdown')) this.engine.ensureStarted();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private has(...ks: string[]) {
    return ks.some((k) => this.keys.has(k));
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.step(dt);
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number) {
    const s = this.state;

    // Keep a fresh local picture of the roads, and drop the car onto the nearest
    // one the first time road data is available.
    this.road.maybeRefresh(this.map, s.lng, s.lat);
    if (!this.snapped && this.road.hasData()) {
      const snap = this.road.snap(s.lng, s.lat);
      if (snap) {
        s.lng = snap.lng;
        s.lat = snap.lat;
        s.heading = snap.heading;
        this.snapped = true;
      }
    }

    // Longitudinal: accelerate / brake / coast.
    const fwd = this.has('w', 'arrowup');
    const back = this.has('s', 'arrowdown');
    if (fwd) s.speed += ACCEL * dt;
    else if (back) s.speed -= BRAKE * dt;
    else {
      const drag = DRAG * dt;
      s.speed = s.speed > 0 ? Math.max(0, s.speed - drag) : Math.min(0, s.speed + drag);
    }
    s.speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, s.speed));

    // Steering only bites while moving; reverse inverts it. Turning tightens at
    // low speed and eases off at high speed so it stays controllable.
    const steer = (this.has('d', 'arrowright') ? 1 : 0) - (this.has('a', 'arrowleft') ? 1 : 0);
    if (steer !== 0 && Math.abs(s.speed) > 0.05) {
      const frac = Math.abs(s.speed) / MAX_SPEED;
      const grip = Math.min(1, Math.abs(s.speed) / 3);
      const rate = TURN_RATE * (1 - 0.55 * frac);
      s.heading += steer * rate * grip * Math.sign(s.speed) * dt;
    }

    // Integrate along heading — but only commit the move if it stays on a road.
    if (s.speed !== 0) {
      const dist = s.speed * dt;
      const nlat = s.lat + (dist * Math.cos(s.heading)) / M_PER_DEG_LAT;
      const nlng = s.lng + (dist * Math.sin(s.heading)) / mPerDegLng(s.lat);
      if (this.road.isOnRoad(nlng, nlat)) {
        s.lat = nlat;
        s.lng = nlng;
      } else {
        // Hit the kerb — bleed off speed and hold position.
        s.speed *= 0.2;
      }
    }

    this.engine.update(Math.abs(s.speed) / MAX_SPEED, fwd);
    this.follow();
    this.onMove?.(s);
  }

  /** Centre the camera slightly ahead of the car, bearing aligned to heading. */
  private follow() {
    const s = this.state;
    const headingDeg = (s.heading * 180) / Math.PI;
    const lookLat = s.lat + (LOOK_AHEAD_M * Math.cos(s.heading)) / M_PER_DEG_LAT;
    const lookLng = s.lng + (LOOK_AHEAD_M * Math.sin(s.heading)) / mPerDegLng(s.lat);

    this.map.jumpTo({
      center: [lookLng, lookLat],
      bearing: headingDeg,
      pitch: RIDE_PITCH,
      zoom: RIDE_ZOOM,
    });
  }
}