import { useState } from 'react';
import Globe from './components/Globe';
import City from './components/City';
import type { Destination } from './cities';
import './App.css';

export default function App() {
  const [dest, setDest] = useState<Destination | null>(null);

  return dest ? (
    <City dest={dest} onBack={() => setDest(null)} />
  ) : (
    <Globe onSelect={setDest} />
  );
}
