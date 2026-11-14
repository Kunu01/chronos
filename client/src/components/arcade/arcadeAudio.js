import { unlockAudioContext } from '../../utils/apiClient';

let muted = false;

export const setArcadeMuted = (next) => {
  muted = Boolean(next);
};

export const isArcadeMuted = () => muted;

const playTone = (freq, endFreq, duration, type = 'sine', volume = 0.08) => {
  if (muted) return;
  const ctx = unlockAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  } catch {
    // Ignore Web Audio autoplay blocks safely
  }
};

export const arcadeSfx = {
  hit: () => playTone(320, 140, 0.08, 'triangle', 0.1),
  wall: () => playTone(520, 380, 0.05, 'sine', 0.05),
  boost: () => playTone(220, 440, 0.09, 'sine', 0.06),
  flip: () => playTone(440, 620, 0.06, 'sine', 0.06),
  cue: () => playTone(880, 880, 0.14, 'triangle', 0.11),
  invite: () => {
    playTone(587, 587, 0.09, 'sine', 0.08);
    setTimeout(() => playTone(880, 880, 0.16, 'triangle', 0.08), 95);
  },
  pearl: () => {
    playTone(660, 880, 0.09, 'sine', 0.07);
    setTimeout(() => playTone(880, 1180, 0.1, 'triangle', 0.06), 60);
  },
  goal: () => {
    playTone(392, 523, 0.14, 'triangle', 0.1);
    setTimeout(() => playTone(523, 784, 0.22, 'triangle', 0.1), 110);
  },
  dash: () => playTone(180, 520, 0.11, 'sawtooth', 0.05),
  crash: () => playTone(170, 45, 0.28, 'sawtooth', 0.11),
  win: () => {
    playTone(523, 659, 0.14, 'triangle', 0.09);
    setTimeout(() => playTone(659, 784, 0.14, 'triangle', 0.09), 110);
    setTimeout(() => playTone(784, 1046, 0.25, 'triangle', 0.1), 220);
  },
};
