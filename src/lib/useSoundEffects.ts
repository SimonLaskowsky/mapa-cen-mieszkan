'use client';

import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'click' | 'pop' | 'ping' | 'swoosh' | 'success' | 'hover' | 'tick';

interface SoundConfig {
  volume: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: SoundConfig = {
  volume: 0.3,
  enabled: true,
};

// Web Audio API sound synthesizer
class SoundSynthesizer {
  private audioContext: AudioContext | null = null;
  private config: SoundConfig;

  constructor(config: SoundConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  setVolume(volume: number) {
    this.config.volume = Math.max(0, Math.min(1, volume));
  }

  play(type: SoundType) {
    if (!this.config.enabled) return;

    try {
      const ctx = this.getContext();

      switch (type) {
        case 'click':
          this.playClick(ctx);
          break;
        case 'pop':
          this.playPop(ctx);
          break;
        case 'ping':
          this.playPing(ctx);
          break;
        case 'swoosh':
          this.playSwoosh(ctx);
          break;
        case 'success':
          this.playSuccess(ctx);
          break;
        case 'hover':
          this.playHover(ctx);
          break;
        case 'tick':
          this.playTick(ctx);
          break;
      }
    } catch (e) {
      // Audio not supported
    }
  }

  // Sharp digital keystroke - like pressing a terminal key
  private playClick(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    // Sharp square wave burst
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.025);

    // Secondary tone for digital texture
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(3200, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.015);

    gain.gain.setValueAtTime(this.config.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
    osc2.stop(ctx.currentTime + 0.03);
  }

  // Data packet burst - like data being transmitted
  private playPop(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Rapid frequency sweep simulating data burst
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.06);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1200, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    gain.gain.setValueAtTime(this.config.volume * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.08);
  }

  // Sonar/radar ping - like a surveillance system detecting a target
  private playPing(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const gain2 = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    // Primary sonar tone
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.4);

    // Harmonic overtone for metallic quality
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(3600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(this.config.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    gain2.gain.setValueAtTime(this.config.volume * 0.06, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc2.stop(ctx.currentTime + 0.2);
  }

  // Digital data stream - encrypted transmission / file transfer sound
  private playSwoosh(ctx: AudioContext) {
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate digital-sounding noise with bit-crush effect
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      const noise = Math.random() * 2 - 1;
      // Bit-crush effect: quantize to simulate digital artifacts
      const crushed = Math.round(noise * 8) / 8;
      // Modulate with a fast carrier for modem-like texture
      const carrier = Math.sin(2 * Math.PI * 4800 * t);
      data[i] = crushed * carrier * Math.pow(1 - i / bufferSize, 1.5);
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const hipass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    source.buffer = buffer;

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    hipass.type = 'highpass';
    hipass.frequency.setValueAtTime(400, ctx.currentTime);

    source.connect(hipass);
    hipass.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(this.config.volume * 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    source.start(ctx.currentTime);
  }

  // Access granted / authentication confirmed - ascending digital tones
  private playSuccess(ctx: AudioContext) {
    // Three ascending tones like a security clearance confirmation
    [0, 0.07, 0.14].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      const freqs = [880, 1320, 1760]; // Ascending triad
      osc.type = 'square';
      osc.frequency.setValueAtTime(freqs[i], ctx.currentTime + delay);

      // Harmonic for digital richness
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freqs[i] * 2, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(this.config.volume * 0.12, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);

      osc.start(ctx.currentTime + delay);
      osc2.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.1);
      osc2.stop(ctx.currentTime + delay + 0.1);
    });
  }

  // Scanner blip - subtle digital scan as cursor moves over targets
  private playHover(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(2200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(this.config.volume * 0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.025);
  }

  // Digital teletype tick - like encrypted data being decoded character by character
  private playTick(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const gain2 = ctx.createGain();

    // Short noise burst for digital texture
    const bufferSize = ctx.sampleRate * 0.03;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Quantized noise for digital character
      data[i] = Math.round(Math.random() * 4) / 4 * 2 - 1;
    }
    noise.buffer = buffer;

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(6000, ctx.currentTime);
    filter.Q.setValueAtTime(3, ctx.currentTime);

    // Tonal component - short blip
    osc.type = 'square';
    osc.frequency.setValueAtTime(3000, ctx.currentTime);

    osc.connect(gain2);
    gain2.connect(ctx.destination);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(this.config.volume * 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    gain2.gain.setValueAtTime(this.config.volume * 0.04, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);

    osc.start(ctx.currentTime);
    noise.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
    noise.stop(ctx.currentTime + 0.02);
  }
}

// Singleton instance
let synthInstance: SoundSynthesizer | null = null;

function getSynth(): SoundSynthesizer {
  if (!synthInstance) {
    synthInstance = new SoundSynthesizer();
  }
  return synthInstance;
}

export function useSoundEffects() {
  const lastHoverTime = useRef(0);

  const playSound = useCallback((type: SoundType) => {
    // Throttle hover sounds
    if (type === 'hover') {
      const now = Date.now();
      if (now - lastHoverTime.current < 50) return;
      lastHoverTime.current = now;
    }

    getSynth().play(type);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    getSynth().setEnabled(enabled);
  }, []);

  const setVolume = useCallback((volume: number) => {
    getSynth().setVolume(volume);
  }, []);

  return {
    playSound,
    setEnabled,
    setVolume,
  };
}

// Export for direct usage without hook
export const playSound = (type: SoundType) => getSynth().play(type);
export const setSoundEnabled = (enabled: boolean) => getSynth().setEnabled(enabled);
export const setSoundVolume = (volume: number) => getSynth().setVolume(volume);
