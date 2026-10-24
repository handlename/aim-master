import { ActiveTarget, GameState } from '../core/game';
import { formatTimeSeconds } from './storage';

export const LOGICAL_WIDTH = 240;
export const LOGICAL_HEIGHT = 272; // 32px Top HUD + 240x240 Square Playfield

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

  // Concentric 8-bit bullseye rings
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

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  totalWaves: number
): void {
  ctx.imageSmoothingEnabled = false;

  // Square Playfield sky background (y: 32..272 is 240x240)
  ctx.fillStyle = '#14142b';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Retro horizon & ground strip at bottom of 240x240 square (y: 236..272)
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(0, 236, LOGICAL_WIDTH, 36);
  ctx.fillStyle = '#5c3820';
  ctx.fillRect(0, 236, LOGICAL_WIDTH, 3);

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

  const remainingTargets = state.targets.filter((t) => !t.hit).length;
  const totalWaveTargets = state.targets.length;

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
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(ex - 10, ey - 2, 20, 4);
    ctx.fillRect(ex - 2, ey - 10, 4, 20);
    ctx.fillStyle = '#ff5555';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('HIT!', ex - 12, ey - 14);
  }

  // Motion trail
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

  // Crosshair reticle
  drawCrosshair(ctx, state.crosshair.x, state.crosshair.y);

  // Phase overlays
  if (state.phase === 'TITLE') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(20, 56, LOGICAL_WIDTH - 40, 96);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 56, LOGICAL_WIDTH - 40, 96);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('AIM MASTER', 56, 84);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('8-BIT QUICK DRAW', 68, 106);

    const bestLabel =
      state.bestTimeMs !== null ? `BEST: ${formatTimeSeconds(state.bestTimeMs)}s` : 'BEST: --.---s';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(bestLabel, 66, 132);
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
}
