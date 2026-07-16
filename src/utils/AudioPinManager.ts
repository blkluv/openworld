// utils/AudioPinManager.ts
import { nearestCityName } from '../data/cities'; // adjust path to your cities file
import { EngineSound } from '../path-to/EngineSound';

type Pin = {
  id: string;
  lat: number;
  lng: number;
  city: string | null; // Auto-tagged from your CITIES list!
  audioBlob: Blob;
  played: boolean;
  timestamp: number;
};

export class AudioPinManager {
  private pins: Pin[] = [];
  private dbName = 'openWorldPins';
  private ctx: AudioContext;
  private engine: EngineSound;

  constructor(ctx: AudioContext, engine: EngineSound) {
    this.ctx = ctx;
    this.engine = engine;
    this.loadFromIndexedDB();
  }

  // --- RECORD (Auto-tags the city) ---
  async recordPin(lat: number, lng: number) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const city = nearestCityName(lng, lat); // <-- YOUR CITY LIST IN ACTION!
      const pin: Pin = {
        id: `${Date.now()}`,
        lat,
        lng,
        city,
        audioBlob: blob,
        played: false,
        timestamp: Date.now(),
      };
      this.pins.push(pin);
      await this.saveToIndexedDB(pin);
      console.log(`📌 Pin saved in ${city || 'Unknown area'}`);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 10000);
  }

  // --- PROXIMITY CHECK (Call this every frame) ---
  checkProximity(currentLat: number, currentLng: number) {
    this.pins.forEach(async (pin) => {
      if (pin.played) return;
      const dist = this.haversine(currentLat, currentLng, pin.lat, pin.lng);
      if (dist < 50) {
        pin.played = true;
        await this.playPin(pin);
        this.saveToIndexedDB(pin);
      }
    });
  }

  // --- PLAYBACK with City Introduction ---
  private async playPin(pin: Pin) {
    try {
      // 1. Duck engine
      this.engine.duck(0.03, 15);

      // 2. Play the user's audio
      const arrayBuffer = await pin.audioBlob.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.9;
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();

      // 3. Show a toast/UI notification with the city name
      console.log(`🗣️ Now playing: Story from ${pin.city || 'the road'}`);
      
      source.onended = () => {
        this.engine.duck(0.15, 0.1);
      };
    } catch (e) {
      console.warn('Playback failed:', e);
      this.engine.duck(0.15, 0.1);
    }
  }

  // --- GET PINS BY CITY (for your UI) ---
  getPinsByCity(): Record<string, Pin[]> {
    const map: Record<string, Pin[]> = {};
    this.pins.forEach(p => {
      const key = p.city || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }

  // --- INDEXEDDB (unchanged) ---
  private async saveToIndexedDB(pin: Pin) {
    const db = await this.openDB();
    const tx = db.transaction('pins', 'readwrite');
    tx.objectStore('pins').put(pin);
    return tx.done;
  }

  private async loadFromIndexedDB() {
    const db = await this.openDB();
    const tx = db.transaction('pins', 'readonly');
    const all = await new Promise<Pin[]>((res) => {
      const req = tx.objectStore('pins').getAll();
      req.onsuccess = () => res(req.result || []);
    });
    this.pins = all;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pins')) {
          db.createObjectStore('pins', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}
