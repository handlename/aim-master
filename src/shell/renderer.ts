import { ActiveTarget, GameState, isPenaltyTarget } from '../core/game';
import { formatTimeSeconds } from './storage';

export const LOGICAL_WIDTH = 240;
export const LOGICAL_HEIGHT = 272; // 32px Top HUD + 240x240 Square Playfield

export interface FireworkParticle {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
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
    // Hazard / Penalty target: Purple-Yellow outer ring, dark core, and bold 'X' mark
    const penaltyRings = [
      { radius: r, color: '#ffcc00' },
      { radius: Math.max(2, Math.round(r * 0.78)), color: '#660099' },
      { radius: Math.max(2, Math.round(r * 0.52)), color: '#1a002c' },
    ];
    for (const ring of penaltyRings) {
      ctx.fillStyle = ring.color;
      ctx.beginPath();
      ctx.arc(x, y, ring.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bold 'X' across the penalty target
    const span = Math.max(4, Math.round(r * 0.45));
    ctx.strokeStyle = '#ff3366';
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

  // Hit burst effects
  for (const effect of state.hitEffects) {
    const ex = Math.round(effect.position.x);
    const ey = Math.round(effect.position.y);
    if (effect.kind === 'penalty') {
      ctx.fillStyle = '#ff3366';
      ctx.fillRect(ex - 10, ey - 2, 20, 4);
      ctx.fillRect(ex - 2, ey - 10, 4, 20);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('+1.0s!', ex - 18, ey - 14);
    } else {
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(ex - 10, ey - 2, 20, 4);
      ctx.fillRect(ex - 2, ey - 10, 4, 20);
      ctx.fillStyle = '#ff5555';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('HIT!', ex - 12, ey - 14);
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
