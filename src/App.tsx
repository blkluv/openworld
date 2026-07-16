import { useState, createContext, useContext, useRef } from 'react';
import Globe from './components/Globe';
import City from './components/City';
import type { Destination } from './cities';
import { AudioPinManager } from './utils/AudioPinManager';
import { EngineSound } from './utils/EngineSound';
import './App.css';

// 1. Create a Context so City can access the audio features
export const AudioManagerContext = createContext<{
  manager: AudioPinManager | null;
  initManager: (ctx: AudioContext, engine: EngineSound) => void;
}>({
  manager: null,
  initManager: () => {},
});

export default function App() {
  // 🔥 DEFAULT: Load directly into MLK Home, Atlanta
  const [dest, setDest] = useState<Destination | null>({
    center: [-84.37196, 33.75513], // MLK Birth Home – 501 Auburn Ave NE, Atlanta, GA
    name: 'MLK Home, Atlanta',
  });

  const managerRef = useRef<AudioPinManager | null>(null);

  // 2. This function is called by City.tsx when the engine is ready
  const initManager = (ctx: AudioContext, engine: EngineSound) => {
    if (!managerRef.current) {
      managerRef.current = new AudioPinManager(ctx, engine);
      console.log('🎧 Audio Pin Manager is LIVE!');
    }
  };

  return (
    <AudioManagerContext.Provider
      value={{ manager: managerRef.current, initManager }}
    >
      {dest ? (
        <City dest={dest} onBack={() => setDest(null)} />
      ) : (
        <Globe onSelect={setDest} />
      )}
    </AudioManagerContext.Provider>
  );
}
