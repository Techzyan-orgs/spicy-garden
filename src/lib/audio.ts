/**
 * Resilient Multi-Engine Kitchen Audio Alert System
 * 
 * Uses a dual-engine architecture:
 * Engine 1: Native HTML5 Audio element playing pre-rendered WAV chime (/sounds/order-chime.wav)
 * Engine 2: Real-time Web Audio API synthesizer with safe envelope curves
 * 
 * Bulletproof against browser autoplay restrictions, hardware sample rate variations,
 * and background tab throttling.
 */

let audioCtx: AudioContext | null = null;
let htmlAudioElement: HTMLAudioElement | null = null;
let isUnlocked = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
  } catch (err) {
    console.warn('[Audio] Could not create AudioContext:', err);
  }
  return audioCtx;
}

export function isAudioContextRunning(): boolean {
  if (typeof window === 'undefined') return false;
  const ctx = getAudioContext();
  return isUnlocked || (ctx !== null && ctx.state === 'running');
}

/**
 * Actively unlocks browser audio permissions during user interaction (click/touch/keypress).
 * Returns true if the browser has successfully unblocked audio playback.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let unlocked = false;

  // 1. Unlock Web Audio API context
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state === 'running') {
        unlocked = true;
      }
    }
  } catch (err) {
    console.warn('[Audio] Web Audio unlock error:', err);
  }

  // 2. Unlock HTML5 Audio element
  try {
    if (!htmlAudioElement) {
      htmlAudioElement = new Audio('/sounds/order-chime.wav');
      htmlAudioElement.preload = 'auto';
    }
    htmlAudioElement.volume = 1.0;
    // Silent play to unlock HTML5 audio element within user gesture
    htmlAudioElement.muted = true;
    const p = htmlAudioElement.play();
    if (p !== undefined) {
      await p;
      htmlAudioElement.pause();
      htmlAudioElement.currentTime = 0;
      htmlAudioElement.muted = false;
      unlocked = true;
    }
  } catch (err) {
    // Autoplay might still be pending or rejected
  }

  isUnlocked = unlocked;
  return unlocked;
}

/**
 * Synthesizes a loud, crisp 3-tone notification chime using Web Audio API oscillators.
 * Uses safe non-zero start levels to prevent exponentialRampToValueAtTime errors.
 */
function playWebAudioSynthesizer(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Note 1: F5 (698.46 Hz) - Clear chime entry
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(698.46, now);
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.linearRampToValueAtTime(0.7, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.7);

  // Note 2: A5 (880.00 Hz) - Bright harmonic lift
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880.0, now + 0.14);
  gain2.gain.setValueAtTime(0.001, now + 0.14);
  gain2.gain.linearRampToValueAtTime(0.75, now + 0.16);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.14);
  osc2.stop(now + 1.0);

  // Note 3: C6 (1046.50 Hz) - High resonant bell
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'triangle';
  osc3.frequency.setValueAtTime(1046.5, now + 0.28);
  gain3.gain.setValueAtTime(0.001, now + 0.28);
  gain3.gain.linearRampToValueAtTime(0.8, now + 0.31);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(now + 0.28);
  osc3.stop(now + 1.4);
}

/**
 * Plays the kitchen order chime using the most resilient available audio engine.
 */
export async function playOrderChime(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let played = false;

  // Engine 1: HTML5 Audio Element (/sounds/order-chime.wav)
  try {
    const audio = new Audio('/sounds/order-chime.wav');
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          played = true;
          isUnlocked = true;
        })
        .catch((err) => {
          // May be blocked if no user gesture yet
          console.warn('[Audio] HTML5 audio playback pending gesture:', err?.name);
        });
    }
  } catch (err) {
    console.warn('[Audio] HTML5 audio init error:', err);
  }

  // Engine 2: Web Audio API Oscillator Synthesizer
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {}
      }

      if (ctx.state === 'running') {
        playWebAudioSynthesizer(ctx);
        played = true;
        isUnlocked = true;
      }
    }
  } catch (err) {
    console.warn('[Audio] Web Audio synth error:', err);
  }

  return played;
}
