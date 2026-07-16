import { useEffect, useRef, useState, useContext } from 'react';
import maplibregl from 'maplibre-gl';
import type { Destination } from '../data/cities';
import { RIDE_PITCH, RIDE_ZOOM, STYLE_URL } from '../lib/style';
import { BikeController, type BikeState } from '../lib/BikeController';
import { AvatarLayer } from '../lib/avatarLayer';
import { AudioManagerContext } from '../App';

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

  const { manager, initManager } = useContext(AudioManagerContext);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const engineRef = useRef<any>(null);

  // --- Sound toggle ---
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    controllerRef.current?.setSoundEnabled(next);
  };

  // --- Record Audio ---
  const handleRecordAudio = async () => {
    if (!manager || !position) {
      console.warn('Manager or position not ready');
      return;
    }
    await manager.recordAudioPin(position.lat, position.lng);
  };

  // --- Record Video (TikTok) ---
  const handleRecordVideo = async () => {
    if (!manager || !position) {
      console.warn('Manager or position not ready');
      return;
    }
    const url = prompt('Paste a TikTok video URL:');
    if (url && url.trim()) {
      await manager.recordVideoPin(position.lat, position.lng, url.trim());
    }
  };

  // --- Initialize map & BikeController ---
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
        // Update position if BikeState includes lat/lng – otherwise fallback below
      });
      controller = controller2;
      controllerRef.current = controller2;

      // Hook up audio manager with engine
      const engine = (controller2 as any).engine;
      if (engine && engine.ctx) {
        engineRef.current = engine;
        initManager(engine.ctx, engine);
        console.log('🎧 Audio manager initialized');
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

  // --- Poll position and check proximity ---
  useEffect(() => {
    if (!ready || !manager) return;

    const interval = setInterval(() => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const pos = (ctrl as any).getPosition?.();
      if (pos) {
        setPosition(pos);
        manager.checkProximity(pos.lat, pos.lng);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ready, manager]);

  // --- Get pin count for the current city (if dest.name matches a city) ---
  const getPinCount = () => {
    if (!manager) return 0;
    const cityPins = manager.getPinsByCity();
    // Try to match by city name – if dest.name is a city name, use that.
    // Otherwise, fallback to 'Other' or total.
    const key = Object.keys(cityPins).find(k => dest.name.includes(k) || k.includes(dest.name));
    return key ? cityPins[key].length : 0;
  };

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
        {manager && ready && (
          <span style={{ fontSize: '0.9rem', marginLeft: '1rem' }}>
            📌 {getPinCount()} story{getPinCount() !== 1 ? 's' : ''}
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

      {/* Record buttons */}
      {ready && manager && position && (
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Audio record button */}
          <button
            onClick={handleRecordAudio}
            style={{
              backgroundColor: '#e53935',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              fontSize: '28px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              cursor: 'pointer',
            }}
            title="Record an audio story at this location"
          >
            🎙️
          </button>
          {/* Video record button */}
          <button
            onClick={handleRecordVideo}
            style={{
              backgroundColor: '#1DA1F2',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              fontSize: '28px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
              cursor: 'pointer',
            }}
            title="Paste a TikTok video URL for this location"
          >
            🎥
          </button>
        </div>
      )}
    </div>
  );
}
