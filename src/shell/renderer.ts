import {
  ActiveTarget,
  GameState,
  HIT_EFFECT_DURATION_MS,
  HitEffect,
  isPenaltyTarget,
} from '../core/game';
import { formatTimeSeconds } from './storage';

export const LOGICAL_WIDTH = 240;
export const LOGICAL_HEIGHT = 272; // 32px Top HUD + 240x240 Square Playfield

export interface FireworkParticle {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
}

export type HitShatterParticle = FireworkParticle;

const NORMAL_SHATTER_COLORS = ['#ff3333', '#ffffff', '#ffcc00', '#ffff00', '#ff6600'] as const;
const PENALTY_SHATTER_COLORS = ['#0066ff', '#ffffff', '#00ffcc', '#66b2ff'] as const;

function createHitPrng(effect: HitEffect): () => number {
  const dir = effect.direction ?? { x: 0, y: -1 };
  const rawSeed =
    effect.seed !== undefined
      ? Math.floor(effect.seed * 2147483647)
      : Math.imul(Math.round(effect.position.x * 131), 73856093) ^
        Math.imul(Math.round(effect.position.y * 137), 19349663) ^
        Math.imul(Math.round((dir.x + 2) * 1000), 83492791) ^
        Math.imul(Math.round((dir.y + 2) * 1000), 49979687);

  let state = (rawSeed | 0) || 123456789;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeHitShatterParticles(effect: HitEffect): readonly HitShatterParticle[] {
  const duration = Math.max(1, effect.durationMs ?? HIT_EFFECT_DURATION_MS);
  const progress = Math.min(1, Math.max(0, (duration - effect.remainingMs) / duration));
  const inv = 1 - progress;

  const dir = effect.direction ?? { x: 0, y: -1 };
  const baseAngle = Math.atan2(dir.y, dir.x);
  const palette = effect.kind === 'penalty' ? PENALTY_SHATTER_COLORS : NORMAL_SHATTER_COLORS;
  const rand = createHitPrng(effect);
  const particles: HitShatterParticle[] = [];

  const shardCount = 18;
  for (let index = 0; index < shardCount; index++) {
    // Triangular distribution centered on 0 so most fragments blast forward, with organic random spread
    const rAngle1 = rand() - 0.5;
    const rAngle2 = rand() - 0.5;
    const angleSpread = (rAngle1 + rAngle2) * 1.45;
    const angle = baseAngle + angleSpread;

    // Randomize travel distance (22px..96px), drag exponent, and gravity per fragment
    const rSpeed = rand();
    const maxDistancePx = 22 + rSpeed * rSpeed * 74;
    const dragPower = 2.2 + rand() * 1.6;
    const easeOut = 1 - Math.pow(inv, dragPower);
    const gravityScale = 8 + rand() * 16;
    const gravityDrop = progress * progress * gravityScale;

    // Slight random spawn offset inside the shattered target body (-5px..+5px)
    const spawnOffsetX = (rand() - 0.5) * 10;
    const spawnOffsetY = (rand() - 0.5) * 10;

    const dist = maxDistancePx * easeOut;
    const x = Math.round(effect.position.x + spawnOffsetX + Math.cos(angle) * dist);
    const y = Math.round(effect.position.y + spawnOffsetY + Math.sin(angle) * dist + gravityDrop);

    const baseSize = 3 + Math.floor(rand() * 4); // 3..6px
    const size =
      progress > 0.75
        ? Math.max(2, baseSize - 2)
        : progress > 0.45
          ? Math.max(2, baseSize - 1)
          : baseSize;

    const colorIndex = Math.floor(rand() * palette.length);
    particles.push({
      x,
      y,
      size,
      color: palette[colorIndex],
    });

    // Random trailing spark on fast fragments
    if (rSpeed > 0.42 && progress < 0.85) {
      const trailFactor = 0.55 + rand() * 0.22;
      const trailDist = dist * trailFactor;
      const tx = Math.round(effect.position.x + spawnOffsetX + Math.cos(angle) * trailDist);
      const ty = Math.round(
        effect.position.y + spawnOffsetY + Math.sin(angle) * trailDist + gravityDrop * 0.65
      );
      particles.push({
        x: tx,
        y: ty,
        size: 2,
        color: '#ffffff',
      });
    }
  }

  return particles;
}

interface FireworkLauncher {
  readonly cx: number;
  readonly cy: number;
  readonly periodMs: number;
  readonly phaseOffsetMs: number;
  readonly maxRadius: number;
  readonly primaryColor: string;
  readonly secondaryColor: string;
}

const FIREWORK_LAUNCHERS: readonly FireworkLauncher[] = [
  {
    cx: 54,
    cy: 78,
    periodMs: 1100,
    phaseOffsetMs: 0,
    maxRadius: 38,
    primaryColor: '#ffcc00',
    secondaryColor: '#ff3366',
  },
  {
    cx: 186,
    cy: 74,
    periodMs: 1250,
    phaseOffsetMs: 320,
    maxRadius: 42,
    primaryColor: '#00ffcc',
    secondaryColor: '#ffff00',
  },
  {
    cx: 120,
    cy: 96,
    periodMs: 980,
    phaseOffsetMs: 620,
    maxRadius: 46,
    primaryColor: '#ff55ff',
    secondaryColor: '#00ff66',
  },
  {
    cx: 68,
    cy: 164,
    periodMs: 1350,
    phaseOffsetMs: 180,
    maxRadius: 34,
    primaryColor: '#ff6600',
    secondaryColor: '#ffffff',
  },
  {
    cx: 174,
    cy: 158,
    periodMs: 1180,
    phaseOffsetMs: 790,
    maxRadius: 36,
    primaryColor: '#00ff66',
    secondaryColor: '#ffcc00',
  },
];

export function computeFireworkParticles(timeMs: number): readonly FireworkParticle[] {
  const safeTime = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
  const particles: FireworkParticle[] = [];

  for (const launcher of FIREWORK_LAUNCHERS) {
    const localTime = (safeTime + launcher.phaseOffsetMs) % launcher.periodMs;
    const progress = localTime / launcher.periodMs;

    if (progress < 0.22) {
      // Rising rocket trail from horizon (y=236) to burst center (cx, cy)
      const riseT = progress / 0.22;
      const ry = 236 - (236 - launcher.cy) * riseT;
      particles.push({
        x: Math.round(launcher.cx),
        y: Math.round(ry),
        size: 3,
        color: '#ffffff',
      });
      particles.push({
        x: Math.round(launcher.cx),
        y: Math.round(ry + 5),
        size: 2,
        color: launcher.primaryColor,
      });
    } else {
      // Radial 8-bit spark burst
      const burstT = (progress - 0.22) / 0.78;
      const easeOut = 1 - (1 - burstT) * (1 - burstT);
      const outerR = launcher.maxRadius * easeOut;
      const innerR = outerR * 0.55;
      const gravityDrop = burstT * burstT * 14;
      const sparkSize = burstT < 0.7 ? 3 : 2;

      const spokeCount = 12;
      for (let i = 0; i < spokeCount; i++) {
        const angle = (i * Math.PI * 2) / spokeCount;
        const ox = launcher.cx + Math.cos(angle) * outerR;
        const oy = launcher.cy + Math.sin(angle) * outerR + gravityDrop;
        particles.push({
          x: Math.round(ox),
          y: Math.round(oy),
          size: sparkSize,
          color: i % 2 === 0 ? launcher.primaryColor : launcher.secondaryColor,
        });

        if (i % 2 === 0 && burstT < 0.85) {
          const ix = launcher.cx + Math.cos(angle + 0.26) * innerR;
          const iy = launcher.cy + Math.sin(angle + 0.26) * innerR + gravityDrop * 0.6;
          particles.push({
            x: Math.round(ix),
            y: Math.round(iy),
            size: 2,
            color: '#ffffff',
          });
        }
      }
    }
  }

  return particles;
}

function drawTarget(ctx: CanvasRenderingContext2D, target: ActiveTarget): void {
  if (target.hit) {
    return;
  }
  const { x, y } = target.position;
  const r = target.blueprint.radius;

  // Hard pixel-style shadow
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
  ctx.fill();

  if (isPenaltyTarget(target.blueprint)) {
    // Obstacle / Penalty target: Blue circle background with white '✗' mark
    ctx.fillStyle = '#0033aa';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0066ff';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r - 2), 0, Math.PI * 2);
    ctx.fill();

    // Draw bold white '✗' across the blue target
    const span = Math.max(4, Math.round(r * 0.45));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - span, y - span);
    ctx.lineTo(x + span, y + span);
    ctx.moveTo(x + span, y - span);
    ctx.lineTo(x - span, y + span);
    ctx.stroke();
    return;
  }

  // Normal target: concentric 8-bit red/white bullseye rings
  const rings = [
    { radius: r, color: '#ff3333' },
    { radius: Math.max(2, Math.round(r * 0.7)), color: '#ffffff' },
    { radius: Math.max(2, Math.round(r * 0.42)), color: '#ff3333' },
    { radius: Math.max(1, Math.round(r * 0.18)), color: '#ffffff' },
  ];

  for (const ring of rings) {
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(x, y, ring.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const boxHalf = 10;

  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - boxHalf, cy - boxHalf, boxHalf * 2, boxHalf * 2);

  ctx.fillStyle = '#00ff66';
  // Horizontal ticks
  ctx.fillRect(cx - boxHalf - 4, cy - 1, 6, 2);
  ctx.fillRect(cx + boxHalf - 2, cy - 1, 6, 2);
  // Vertical ticks
  ctx.fillRect(cx - 1, cy - boxHalf - 4, 2, 6);
  ctx.fillRect(cx - 1, cy + boxHalf - 2, 2, 6);
  // Center dot
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

function drawCalibrationGrid(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 255, 204, 0.28)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Vertical center guide (x = 120)
  ctx.beginPath();
  ctx.moveTo(120, 34);
  ctx.lineTo(120, 236);
  ctx.stroke();

  // Horizontal center guide (y = 152)
  ctx.beginPath();
  ctx.moveTo(8, 152);
  ctx.lineTo(232, 152);
  ctx.stroke();
  ctx.restore();
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  totalWaves: number,
  nowMs: number = 0
): void {
  ctx.imageSmoothingEnabled = false;

  // Square Playfield sky background (y: 32..272 is 240x240)
  ctx.fillStyle =
    state.phase === 'TITLE' || state.phase === 'RESULT' ? '#1c1c3c' : '#14142b';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Retro horizon & ground strip at bottom of 240x240 square (y: 236..272)
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(0, 236, LOGICAL_WIDTH, 36);
  ctx.fillStyle = '#5c3820';
  ctx.fillRect(0, 236, LOGICAL_WIDTH, 3);

  if (state.phase === 'TITLE' || state.phase === 'RESULT') {
    drawCalibrationGrid(ctx);
  }

  // Celebratory 8-bit fireworks in the background on NEW RECORD
  if (state.phase === 'RESULT' && state.isNewRecord) {
    const particles = computeFireworkParticles(nowMs);
    for (const p of particles) {
      if (p.y >= 32 && p.y <= 268) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size);
      }
    }
  }

  // Top HUD (y: 0..32)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 30, LOGICAL_WIDTH, 2);

  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.fillText('TIME', 6, 15);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(formatTimeSeconds(state.elapsedMs), 34, 15);

  const normalTargets = state.targets.filter((t) => !isPenaltyTarget(t.blueprint));
  const remainingTargets = normalTargets.filter((t) => !t.hit).length;
  const totalWaveTargets = normalTargets.length;

  ctx.fillStyle = '#ffffff';
  ctx.fillText('WV', 98, 15);
  ctx.fillStyle = '#00ffcc';
  ctx.fillText(`${Math.min(totalWaves, state.waveIndex + 1)}/${totalWaves}`, 114, 15);

  ctx.fillStyle = '#ffffff';
  ctx.fillText('TGT', 164, 15);
  ctx.fillStyle = '#00ffcc';
  ctx.fillText(`${remainingTargets}/${totalWaveTargets}`, 188, 15);

  // Active targets
  for (const target of state.targets) {
    drawTarget(ctx, target);
  }

  // Hit burst & directional shatter effects
  for (const effect of state.hitEffects) {
    const ex = Math.round(effect.position.x);
    const ey = Math.round(effect.position.y);
    const duration = Math.max(1, effect.durationMs ?? HIT_EFFECT_DURATION_MS);
    const progress = Math.min(1, Math.max(0, (duration - effect.remainingMs) / duration));
    const dir = effect.direction ?? { x: 0, y: -1 };

    // Intense initial impact flash & shockwave ring shifted slightly toward blast direction
    if (progress < 0.5) {
      const flashT = progress / 0.5;
      const ringRadius = Math.round(8 + flashT * 22);
      const ringCenterX = Math.round(ex + dir.x * flashT * 10);
      const ringCenterY = Math.round(ey + dir.y * flashT * 10);

      ctx.strokeStyle =
        flashT < 0.35 ? '#ffffff' : effect.kind === 'penalty' ? '#00ffcc' : '#ffff00';
      ctx.lineWidth = flashT < 0.25 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(ringCenterX, ringCenterY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      const arm = Math.round(12 + flashT * 16);
      ctx.fillStyle = effect.kind === 'penalty' ? '#00ffcc' : '#ffff00';
      ctx.fillRect(ex - arm, ey - 2, arm * 2, 4);
      ctx.fillRect(ex - 2, ey - arm, 4, arm * 2);
    }

    // Directional shatter fragments pushed opposite to the impacting crosshair with pixel drop shadow
    const shards = computeHitShatterParticles(effect);
    for (const shard of shards) {
      const half = shard.size >> 1;
      if (shard.size >= 3) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(shard.x - half + 1, shard.y - half + 1, shard.size, shard.size);
      }
      ctx.fillStyle = shard.color;
      ctx.fillRect(shard.x - half, shard.y - half, shard.size, shard.size);
    }

    const labelOffsetY = Math.round(progress * 8);
    if (effect.kind === 'penalty') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('+1.0s!', ex - 18, ey - 14 - labelOffsetY);
    } else {
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('HIT!', ex - 12, ey - 14 - labelOffsetY);
    }
  }

  // Phase overlays (drawn BEFORE crosshair so the crosshair stays visible on top!)
  if (state.phase === 'TITLE') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(20, 62, LOGICAL_WIDTH - 40, 78);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 62, LOGICAL_WIDTH - 40, 78);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('AIM MASTER', 56, 88);

    const bestLabel =
      state.bestTimeMs !== null ? `BEST: ${formatTimeSeconds(state.bestTimeMs)}s` : 'BEST: --.---s';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(bestLabel, 66, 118);
  } else if (state.phase === 'COUNTDOWN') {
    const sec = Math.ceil(state.countdownRemainingMs / 600);
    const label = sec >= 1 ? `READY... ${sec}` : 'GO!';
    ctx.fillStyle = '#000000';
    ctx.fillRect(48, 130, LOGICAL_WIDTH - 96, 44);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 130, LOGICAL_WIDTH - 96, 44);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(label, 68, 152);
  }

  // Motion trail & Crosshair reticle drawn last so they are always visible while testing options
  if (state.recentTrail.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let i = 0; i < state.recentTrail.length; i++) {
      const pt = state.recentTrail[i];
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawCrosshair(ctx, state.crosshair.x, state.crosshair.y);
}
