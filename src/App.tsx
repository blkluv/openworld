import { useState, createContext, useRef } from 'react';
import Globe from './components/Globe';
import City from './components/City';
import type { Destination } from './cities';
import { AudioPinManager } from './utils/AudioPinManager';
import { EngineSound } from './lib/EngineSound'; // <-- corrected path
import './App.css';

export const AudioManagerContext = createContext<{
  manager: AudioPinManager | null;
  initManager: (ctx: AudioContext, engine: EngineSound) => void;
}>({
  manager: null,
  initManager: () => {},
});

export default function App() {
  const [dest, setDest] = useState<Destination | null>({
    center: [-84.37196, 33.75513],
    name: 'MLK Home, Atlanta',
  });

  const managerRef = useRef<AudioPinManager | null>(null);

  const initManager = (ctx: AudioContext, engine: EngineSound) => {
    if (!managerRef.current) {
      managerRef.current = new AudioPinManager(ctx, engine);
      console.log('🎧 Audio Pin Manager is LIVE!');
    }
  };

  return (
    <AudioManagerContext.Provider value={{ manager: managerRef.current, initManager }}>
      {dest ? (
        <City dest={dest} onBack={() => setDest(null)} />
      ) : (
        <Globe onSelect={setDest} />
      )}
    </AudioManagerContext.Provider>
  );
}
