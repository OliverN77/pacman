// Sintetizador arcade en Web Audio API (sin archivos externos)
class PacmanAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.wakaToggle = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, Number(vol)));
    this.volume = Number.isFinite(clamped) ? clamped : 0.7;
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freqStart, freqEnd, duration, type = "square", volume = 0.08, delay = 0) {
    if (this.muted || this.volume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const effectiveVol = Math.max(0.0005, volume * this.volume);
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(effectiveVol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playUiClick() {
    this.playTone(580, 740, 0.045, "triangle", 0.05);
  }

  playWaka() {
    this.wakaToggle = !this.wakaToggle;
    if (this.wakaToggle) {
      this.playTone(270, 440, 0.075, "triangle", 0.09);
    } else {
      this.playTone(430, 240, 0.075, "triangle", 0.09);
    }
  }

  playPowerPellet() {
    this.playTone(320, 640, 0.12, "square", 0.07, 0);
    this.playTone(480, 880, 0.16, "square", 0.07, 0.09);
  }

  playEatGhost() {
    this.playTone(260, 920, 0.22, "sawtooth", 0.085, 0);
    this.playTone(520, 1280, 0.18, "triangle", 0.08, 0.12);
  }

  playEatFruit() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq * 1.03, 0.08, "triangle", 0.09, idx * 0.055);
    });
  }

  playExtraLife() {
    const notes = [659.25, 783.99, 1318.5, 1046.5, 1174.66, 1567.98];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq, 0.095, "square", 0.07, idx * 0.08);
    });
  }

  playStartJingle() {
    const seq = [
      [493.88, 0.00, 0.11],
      [987.77, 0.12, 0.11],
      [739.99, 0.24, 0.11],
      [622.25, 0.36, 0.11],
      [987.77, 0.48, 0.11],
      [739.99, 0.60, 0.16],
      [622.25, 0.78, 0.20],
      [523.25, 1.02, 0.11],
      [1046.5, 1.14, 0.11],
      [783.99, 1.26, 0.11],
      [659.25, 1.38, 0.11],
      [1046.5, 1.50, 0.11],
      [783.99, 1.62, 0.18],
      [659.25, 1.82, 0.24],
    ];
    seq.forEach(([freq, delay, dur]) => {
      this.playTone(freq, freq, dur, "square", 0.06, delay);
    });
  }

  playDeath() {
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const f1 = 620 - i * 44;
      const f2 = f1 - 55;
      this.playTone(f1, Math.max(90, f2), 0.1, "sawtooth", 0.075, i * 0.095);
    }
    this.playTone(180, 65, 0.28, "triangle", 0.09, steps * 0.095);
  }

  playLevelClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, freq, idx === notes.length - 1 ? 0.35 : 0.11, "square", 0.065, idx * 0.11);
    });
  }
}

window.PacmanAudio = PacmanAudio;
