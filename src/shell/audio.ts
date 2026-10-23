import { GameAudioEvent } from '../core/game';

export class RetroAudio {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  public play(event: GameAudioEvent): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    switch (event) {
      case 'COUNTDOWN_TICK':
        this.playTone(ctx, 440, 440, now, 0.07, 0.12);
        break;
      case 'COUNTDOWN_GO':
        this.playTone(ctx, 880, 880, now, 0.16, 0.16);
        break;
      case 'TARGET_HIT':
        this.playTone(ctx, 960, 260, now, 0.09, 0.18);
        break;
      case 'WAVE_CLEAR':
        this.playTone(ctx, 660, 660, now, 0.06, 0.14);
        this.playTone(ctx, 990, 990, now + 0.06, 0.09, 0.14);
        break;
      case 'GAME_CLEAR': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          this.playTone(ctx, freq, freq, now + idx * 0.09, 0.11, 0.16);
        });
        break;
      }
    }
  }

  private playTone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    startTime: number,
    durationSec: number,
    peakGain: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + durationSec);
    }

    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSec);
  }
}
