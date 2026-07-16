/**
 * A procedural car-engine sound (Web Audio, no audio files).
 *
 * The key to sounding like an engine rather than a synth tone: an engine is a
 * train of exhaust *firing pulses*, heard as a rhythmic rumble that pitches up
 * with the revs — not a pure oscillator. So we synthesise a short looped buffer
 * of decaying pulses (with per-pulse variance so it doesn't sound like a tone)
 * and change its `playbackRate` to rev. A manual-gearbox rev model makes the
 * pitch rise within a gear and drop on each upshift.
 *
 * An AudioContext can only start after a user gesture, so `ensureStarted()` is
 * called from the first key press (or the sound toggle).
 */
export class EngineSound {
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private enabled = true;
  private lastRpm = 0.28;

  // --- NEW: store the current “normal” volume to restore after ducking ---
  private normalVolume = 0;

  /** Build ~0.5 s of looping engine pulses. */
  private buildBuffer(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.5;
    const len = Math.floor(sr * dur);
    const cylinders = 8; // pulses per loop
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const slot = Math.floor(len / cylinders);

    for (let p = 0; p < cylinders; p++) {
      const start = p * slot;
      const f = 64 + (Math.random() * 10 - 5); // slight per-firing variance
      const decay = 26 + Math.random() * 6;
      const amp = 0.85 + Math.random() * 0.15;
      for (let i = 0; i < slot; i++) {
        const t = i / sr;
        const env = Math.exp(-decay * t);
        const tone = Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2 * t);
        const noise = (Math.random() * 2 - 1) * 0.5;
        d[start + i] += env * (tone + noise) * amp;
      }
    }

    // Normalise.
    let max = 0;
    for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(d[i]));
    if (max > 0) for (let i = 0; i < len; i++) d[i] /= max * 1.1;
    return buf;
  }

  ensureStarted() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      const src = ctx.createBufferSource();
      src.buffer = this.buildBuffer(ctx);
      src.loop = true;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();

      this.ctx = ctx;
      this.src = src;
      this.gain = gain;
      this.filter = filter;
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // Audio unavailable (e.g. headless) — silently no-op.
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.ensureStarted();
    if (!on && this.ctx && this.gain) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  /**
   * Upshift points as fractions of top speed. Revs climb within a gear and drop
   * at each boundary (the gear change); the final gear extends past 1.0 so top
   * speed sits mid-rev rather than maxed out.
   */
  private static readonly SHIFTS = [0, 0.16, 0.34, 0.52, 0.7, 0.88, 1.18];

  /** speedFrac 0..1 of top speed; throttle = accelerator held. */
  update(speedFrac: number, throttle: boolean) {
    if (!this.ctx || !this.src || !this.gain || !this.filter) return;
    const f = Math.max(0, Math.min(1, speedFrac));

    const S = EngineSound.SHIFTS;
    let g = 0;
    while (g < S.length - 2 && f >= S[g + 1]) g++;
    const within = S[g + 1] > S[g] ? Math.min(1, (f - S[g]) / (S[g + 1] - S[g])) : 0;
    // Ease the rev toward its target so gear changes blip rather than jump.
    const targetRpm = 0.28 + 0.64 * within;
    this.lastRpm += (targetRpm - this.lastRpm) * 0.25;
    const rpm = this.lastRpm;

    const now = this.ctx.currentTime;
    const rate = 0.7 + rpm * 1.7; // playback speed = engine revs
    this.src.playbackRate.setTargetAtTime(rate, now, 0.08);
    this.filter.frequency.setTargetAtTime(320 + rpm * 1500, now, 0.1);
    const vol = this.enabled ? (throttle ? 0.16 : 0.085) + rpm * 0.05 : 0;
    // Store the normal volume so duck() can restore it later
    this.normalVolume = vol;
    this.gain.gain.setTargetAtTime(vol, now, 0.1);
  }

  /**
   * Temporarily duck the engine volume to let another audio source (e.g. a voice pin)
   * be heard clearly. The volume is reduced to `level` over a short ramp, and after
   * `duration` seconds it is restored to the normal level (which will be overridden
   * by the next call to `update()` anyway).
   *
   * @param level  volume to duck to (default 0.04, very quiet)
   * @param duration  seconds to stay ducked before restoring (default 1.2)
   */
  duck(level: number = 0.04, duration: number = 1.2) {
    if (!this.gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Duck quickly
    this.gain.gain.setTargetAtTime(level, now, 0.05);
    // After `duration`, restore to the normal volume (as last computed)
    // Use a longer ramp for a smooth transition back.
    setTimeout(() => {
      if (this.gain && this.ctx) {
        // Restore to the stored normal volume; `update()` will override it anyway
        this.gain.gain.setTargetAtTime(this.normalVolume, this.ctx.currentTime, 0.15);
      }
    }, duration * 1000);
  }

  stop() {
    try {
      this.gain?.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.05);
      this.src?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = this.src = this.gain = this.filter = null as never;
  }
}
