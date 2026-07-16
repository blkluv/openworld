import { useEffect, useRef, useState, useContext } from 'react';
import maplibregl from 'maplibre-gl';
import type { Destination } from '../cities';
import { RIDE_PITCH, RIDE_ZOOM, STYLE_URL } from '../lib/style';
import { BikeController, type BikeState } from '../lib/BikeController';
import { AvatarLayer } from '../lib/avatarLayer';
import { AudioManagerContext } from '../App'; // <-- NEW: import the context

interface Props {
  dest: Destination;
  onBack: () => void;
}

export default function City({ dest, onBack }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BikeController | null>(null);
  const [speed, setSpeed] = useState(0);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // NEW: get audio manager from context
  const { manager, initManager } = useContext(AudioManagerContext);

  // NEW: state to store current position (for recording)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  // NEW: ref to hold the engine sound instance from the controller
  const engineRef = useRef<any>(null);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    controllerRef.current?.setSoundEnabled(next);
  };

  // NEW: handler for the record button
  const handleRecord = async () => {
    if (!manager || !position) {
      console.warn('Manager or position not ready');
      return;
    }
    await manager.recordPin(position.lat, position.lng);
  };

  useEffect(() => {
    if (!ref.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: dest.center,
      zoom: RIDE_ZOOM,
      pitch: RIDE_PITCH,
      bearing: 0,
      attributionControl: { compact: true },
      interactive: false,
    });

    let controller: BikeController | null = null;

    map.on('style.load', () => {
      map.resize();
      const controller2 = new BikeController(map, dest.center, (s: BikeState) => {
        setSpeed(Math.abs(s.speed));
        // NEW: also store the current position (assuming BikeState has lat/lng)
        // If BikeState doesn't have it, we'll get it from controller2.getPosition() below
      });
      controller = controller2;
      controllerRef.current = controller2;

      // --- NEW: hook up the audio manager ---
      // 1. Get the engine sound instance from the controller (assume it's public)
      const engine = (controller2 as any).engine; // or .sound, .audioEngine, etc.
      if (engine && engine.ctx) {
        engineRef.current = engine;
        initManager(engine.ctx, engine);
        console.log('🎧 Audio manager initialized with engine');
      } else {
        console.warn('Engine sound not found on BikeController');
      }

      if (import.meta.env.DEV) (window as unknown as { __bike?: unknown }).__bike = controller2;
      controller2.start();
      map.addLayer(new AvatarLayer(controller2));
      setReady(true);
    });

    return () => {
      controller?.stop();
      map.remove();
    };
  }, [dest, initManager]);

  // --- NEW: Poll position from controller and check proximity ---
  useEffect(() => {
    if (!ready || !manager) return;

    const interval = setInterval(() => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      // Assume BikeController has a method getPosition() returning { lat, lng }
      // If not, you can expose it or use the position from the callback above.
      // For now, we'll try to get it via a method:
      const pos = (ctrl as any).getPosition?.(); // fallback
      if (pos) {
        setPosition(pos);
        manager.checkProximity(pos.lat, pos.lng);
      }
    }, 2000); // check every 2 seconds

    return () => clearInterval(interval);
  }, [ready, manager]);

  return (
    <div className="view">
      <div ref={ref} className="map" />

      <div className="top-right">
        {ready && (
          <button className="sound-btn" onClick={toggleSound} title="Toggle engine sound">
            {soundOn ? '🔊' : '🔇'}
          </button>
        )}
        <button className="back-btn" onClick={onBack}>
          ← Globe
        </button>
      </div>

      <div className="hud hud-top">
        <h2>{dest.name}</h2>
        {/* NEW: show pin count if manager is ready */}
        {manager && ready && (
          <span style={{ fontSize: '0.9rem', marginLeft: '1rem' }}>
            📌 {Object.values(manager.getPinsByCity()).reduce((acc, arr) => acc + arr.length, 0)} stories
          </span>
        )}
      </div>

      {ready && (
        <div className="hud hud-bottom">
          <div className="controls">
            <span><kbd>W</kbd> accelerate</span>
            <span><kbd>S</kbd> brake</span>
            <span><kbd>A</kbd>/<kbd>D</kbd> steer</span>
          </div>
          <div className="speedo">{Math.round(speed * 3.6)} km/h</div>
        </div>
      )}

      {/* NEW: Record button (appears when ready) */}
      {ready && manager && position && (
        <button
          onClick={handleRecord}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            zIndex: 50,
            backgroundColor: '#e53935',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '70px',
            height: '70px',
            fontSize: '30px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            cursor: 'pointer',
          }}
          title="Record an audio story at this location"
        >
          🎙️
        </button>
      )}
    </div>
  );
}
