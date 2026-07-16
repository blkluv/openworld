import { nearestCityName } from '../data/cities';
import { EngineSound } from './EngineSound';

type Pin = {
  id: string;
  lat: number;
  lng: number;
  city: string | null;
  audioBlob: Blob | null;
  videoUrl: string | null;
  threeWords: string | null;
  played: boolean;
  timestamp: number;
};

export class AudioPinManager {
  private pins: Pin[] = [];
  private dbName = 'openWorldPins';
  private ctx: AudioContext;
  private engine: EngineSound;

  // Optional rwatok.land API – set if you have a key
  private readonly RWATOK_API_KEY = 'YOUR_RWATOK_API_KEY';
  private readonly RWATOK_API_URL = 'https://api.rwatok.land/v1/convert-to-3wa';

  constructor(ctx: AudioContext, engine: EngineSound) {
    this.ctx = ctx;
    this.engine = engine;
    this.loadFromIndexedDB();
  }

  async recordAudioPin(lat: number, lng: number) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const city = nearestCityName(lng, lat);
      const threeWords = await this.fetchRwatokAddress(lng, lat);
      const pin: Pin = {
        id: `${Date.now()}`,
        lat,
        lng,
        city,
        audioBlob: blob,
        videoUrl: null,
        threeWords,
        played: false,
        timestamp: Date.now(),
      };
      this.pins.push(pin);
      await this.saveToIndexedDB(pin);
      console.log(`📌 Audio pin saved in ${city || 'Unknown'} – rwatok: ${threeWords || 'N/A'}`);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 10000);
  }

  async recordVideoPin(lat: number, lng: number, videoUrl: string) {
    if (!videoUrl.includes('tiktok.com')) {
      console.warn('Only TikTok URLs are supported.');
      return;
    }
    const city = nearestCityName(lng, lat);
    const threeWords = await this.fetchRwatokAddress(lng, lat);
    const pin: Pin = {
      id: `${Date.now()}`,
      lat,
      lng,
      city,
      audioBlob: null,
      videoUrl,
      threeWords,
      played: false,
      timestamp: Date.now(),
    };
    this.pins.push(pin);
    await this.saveToIndexedDB(pin);
    console.log(`📹 Video pin saved in ${city || 'Unknown'} – rwatok: ${threeWords || 'N/A'}`);
  }

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

  private async playPin(pin: Pin) {
    try {
      this.engine.duck(0.03, 20);

      if (pin.videoUrl) {
        this.showVideoPopup(pin.videoUrl, pin.city, pin.threeWords);
        setTimeout(() => this.engine.duck(0.15, 0.1), 20000);
        return;
      }

      if (pin.audioBlob) {
        const arrayBuffer = await pin.audioBlob.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.9;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();
        console.log(`🗣️ Playing audio from ${pin.city || 'the road'} (rwatok: ${pin.threeWords})`);
        source.onended = () => this.engine.duck(0.15, 0.1);
      } else {
        console.warn('Pin has neither audio nor video.');
        this.engine.duck(0.15, 0.1);
      }
    } catch (e) {
      console.warn('Playback failed:', e);
      this.engine.duck(0.15, 0.1);
    }
  }

  private async showVideoPopup(url: string, city: string | null, threeWords: string | null) {
    const embedUrl = await this.getTikTokEmbedUrl(url);
    if (!embedUrl) {
      console.warn('Could not resolve TikTok video.');
      return;
    }

    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      width: 90%; max-width: 400px; background: #000; border-radius: 16px;
      z-index: 9999; box-shadow: 0 10px 40px rgba(0,0,0,0.9);
      padding: 8px; transition: all 0.3s;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      color: #fff; padding: 8px 12px; font-size: 14px; font-family: sans-serif;
      background: rgba(0,0,0,0.7); border-radius: 8px 8px 0 0;
    `;
    label.textContent = `${city || 'Unknown'} ${threeWords ? '· ' + threeWords : ''}`;
    container.appendChild(label);

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.width = '100%';
    iframe.height = '400px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '0 0 12px 12px';
    iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
    container.appendChild(iframe);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute; top: -12px; right: -12px;
      background: #ff2d55; color: white; border: none;
      border-radius: 50%; width: 30px; height: 30px;
      font-size: 18px; cursor: pointer; font-weight: bold;
    `;
    closeBtn.onclick = () => {
      container.remove();
      this.engine.duck(0.15, 0.1);
    };
    container.appendChild(closeBtn);

    document.body.appendChild(container);

    setTimeout(() => {
      if (container.parentNode) container.remove();
    }, 20000);
  }

  private async getTikTokEmbedUrl(url: string): Promise<string | null> {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl);
      if (!res.ok) {
        const videoId = this.extractVideoIdFromUrl(url);
        return videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null;
      }
      const data = await res.json();
      if (data.embed_url) return data.embed_url;
      if (data.video_id) return `https://www.tiktok.com/embed/v2/${data.video_id}`;
      return null;
    } catch {
      const videoId = this.extractVideoIdFromUrl(url);
      return videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null;
    }
  }

  private extractVideoIdFromUrl(url: string): string | null {
    const shortMatch = url.match(/\/t\/([A-Za-z0-9\-_]+)/);
    if (shortMatch) return null; // force oEmbed for short URLs
    const longMatch = url.match(/\/video\/(\d+)/);
    return longMatch ? longMatch[1] : null;
  }

  private async fetchRwatokAddress(lng: number, lat: number): Promise<string | null> {
    if (!this.RWATOK_API_KEY || this.RWATOK_API_KEY === 'YOUR_RWATOK_API_KEY') {
      return null;
    }
    try {
      const url = `${this.RWATOK_API_URL}?coordinates=${lat},${lng}&key=${this.RWATOK_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.words || data.address || null;
    } catch {
      return null;
    }
  }

  getPinsByThreeWord(threeWords: string): Pin[] {
    return this.pins.filter(p => p.threeWords === threeWords);
  }

  getPinsByCity(): Record<string, Pin[]> {
    const map: Record<string, Pin[]> = {};
    this.pins.forEach(p => {
      const key = p.city || 'Other';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }

  // --- FIXED: IndexedDB save with Promise (replaces tx.done) ---
  private async saveToIndexedDB(pin: Pin) {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pins', 'readwrite');
      const store = tx.objectStore('pins');
      const request = store.put(pin);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  }

  private async loadFromIndexedDB() {
    const db = await this.openDB();
    const tx = db.transaction('pins', 'readonly');
    const all = await new Promise<Pin[]>((res) => {
      const req = tx.objectStore('pins').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
    this.pins = all;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, 2);
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
