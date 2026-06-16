import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { Destination } from '../cities';
import { RIDE_PITCH, RIDE_ZOOM, STYLE_URL } from '../lib/style';
import { BikeController, type BikeState } from '../lib/BikeController';
import { AvatarLayer } from '../lib/avatarLayer';

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

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    controllerRef.current?.setSoundEnabled(next);
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
      // We drive the camera ourselves while driving.
      interactive: false,
    });

    let controller: BikeController | null = null;

    map.on('style.load', () => {
      map.resize();
      const controller2 = new BikeController(map, dest.center, (s: BikeState) => {
        setSpeed(Math.abs(s.speed));
      });
      controller = controller2;
      controllerRef.current = controller2;
      if (import.meta.env.DEV) (window as unknown as { __bike?: unknown }).__bike = controller2;
      controller2.start();
      map.addLayer(new AvatarLayer(controller2));
      setReady(true);
    });

    return () => {
      controller?.stop();
      map.remove();
    };
  }, [dest]);

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
    </div>
  );
}
