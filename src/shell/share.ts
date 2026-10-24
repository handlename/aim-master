import { Point } from '../core/geometry';
import { formatTimeSeconds } from './storage';

export interface ResultCardData {
  readonly clearTimeMs: number;
  readonly bestTimeMs: number;
  readonly isNewRecord: boolean;
  readonly penaltyHits: number;
  readonly clearedAt: string;
  readonly fullTrace: readonly Point[];
}

export function buildShareText(): string {
  return 'AIM MASTER #AIMMASTER';
}

export function buildXIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function renderResultCardToCanvas(
  ctx: CanvasRenderingContext2D,
  data: ResultCardData
): void {
  const width = 600;
  const height = 400;
  ctx.imageSmoothingEnabled = false;

  // Outer background
  ctx.fillStyle = '#0c0c1e';
  ctx.fillRect(0, 0, width, height);

  // Double 8-bit frame border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.strokeStyle = '#ff3333';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Header bar
  ctx.fillStyle = '#000000';
  ctx.fillRect(24, 24, width - 48, 56);
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 26px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('AIM MASTER', 40, 52);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(data.clearedAt, 376, 52);

  // Left side: Times & Rank
  const clearStr = `${formatTimeSeconds(data.clearTimeMs)}s`;
  const bestStr = `${formatTimeSeconds(data.bestTimeMs)}s`;

  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('CLEAR TIME', 44, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px monospace';
  ctx.fillText(clearStr, 44, 170);

  if (data.isNewRecord) {
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(44, 200, 168, 28);
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('★ NEW RECORD! ★', 52, 215);
  }

  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`BEST TIME: ${bestStr}`, 44, 252);

  ctx.fillStyle = data.penaltyHits > 0 ? '#66b2ff' : '#aaaaaa';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`PENALTY HITS: ${data.penaltyHits}`, 44, 280);

  // Bullseye emblem
  const bx = 84;
  const by = 326;
  const radii = [24, 17, 10, 4];
  const colors = ['#ff3333', '#ffffff', '#ff3333', '#ffffff'];
  for (let i = 0; i < radii.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.arc(bx, by, radii[i], 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#00ff66';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ALL 10 WAVES CLEARED', 122, 326);

  // Right side: Square Aim Trajectory Mini-Map (playfield 240x240 -> 200x200)
  const mapX = 356;
  const mapY = 128;
  const mapSize = 200;

  ctx.fillStyle = '#060612';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('AIM TRACE LOG', mapX + 52, mapY - 12);

  if (data.fullTrace.length > 1) {
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.fullTrace.length; i++) {
      const pt = data.fullTrace[i];
      // Map square playfield x: 0..240 -> 0..200, y: 32..272 -> 0..200
      const px = mapX + Math.min(mapSize, Math.max(0, (pt.x / 240) * mapSize));
      const py = mapY + Math.min(mapSize, Math.max(0, ((pt.y - 32) / 240) * mapSize));
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
}

export async function generateResultCardBlob(
  data: ResultCardData
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D context for result card');
  }
  renderResultCardToCanvas(ctx, data);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
      } else {
        reject(new Error('Canvas toBlob returned null'));
      }
    }, 'image/png');
  });
  return { blob, dataUrl };
}

export async function shareResult(
  _data: ResultCardData,
  blob: Blob
): Promise<'shared-native' | 'opened-x'> {
  const text = buildShareText();
  const file = new File([blob], 'aim-master-result.png', { type: 'image/png' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const shareData: ShareData =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
          ? {
              text,
              files: [file],
            }
          : {
              text,
            };
      await navigator.share(shareData);
      return 'shared-native';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared-native';
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.open(buildXIntentUrl(text), '_blank', 'noopener,noreferrer');
  }
  return 'opened-x';
}
