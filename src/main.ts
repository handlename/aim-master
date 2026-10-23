import { createInitialGameState, startCountdown, stepGame } from './core/game';
import { clampPoint } from './core/geometry';
import {
  PLAYFIELD_BOUNDS,
  PermissionTarget,
  createInitialSensorState,
  requestSensorPermissions,
  resetCenter,
  shouldApplyPointerFallback,
  stepCrosshairFromMotion,
  stepCrosshairFromOrientation,
} from './core/sensor';
import { DEFAULT_WAVES } from './core/waves';
import { RetroAudio } from './shell/audio';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, renderGame } from './shell/renderer';
import { ResultCardData, generateResultCardBlob, shareResult } from './shell/share';
import { formatTimeSeconds, loadBestTime, saveBestTime } from './shell/storage';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const titleOverlay = document.getElementById('title-overlay') as HTMLDivElement;
const resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const resultHeading = document.getElementById('result-heading') as HTMLHeadingElement;
const resultCardImg = document.getElementById('result-card-img') as HTMLImageElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
const downloadLink = document.getElementById('download-link') as HTMLAnchorElement;
const resetCenterBtn = document.getElementById('reset-center-btn') as HTMLButtonElement;

const audio = new RetroAudio();
let sensorState = createInitialSensorState();
let gameState = createInitialGameState(loadBestTime());

let hasMotionEvents = false;
let isStartingRun = false;
let lastMotionTimestampMs: number | null = null;
let latestResultBlob: Blob | null = null;
let latestResultData: ResultCardData | null = null;

async function requestSensorPermissionsIfNeeded(): Promise<void> {
  const motionCtor =
    typeof DeviceMotionEvent !== 'undefined'
      ? (DeviceMotionEvent as unknown as PermissionTarget)
      : undefined;
  const orientCtor =
    typeof DeviceOrientationEvent !== 'undefined'
      ? (DeviceOrientationEvent as unknown as PermissionTarget)
      : undefined;
  await requestSensorPermissions(motionCtor, orientCtor);
}

window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
  const rot = event.rotationRate;
  if (!rot || (rot.alpha === null && rot.beta === null && rot.gamma === null)) {
    return;
  }
  hasMotionEvents = true;
  const now = performance.now();
  const dtSec =
    lastMotionTimestampMs !== null
      ? (now - lastMotionTimestampMs) / 1000
      : event.interval > 0
        ? event.interval / 1000
        : 0.016;
  lastMotionTimestampMs = now;

  const accG = event.accelerationIncludingGravity;
  sensorState = stepCrosshairFromMotion(sensorState, {
    alphaRate: rot.alpha,
    betaRate: rot.beta,
    gammaRate: rot.gamma,
    gx: accG?.x ?? null,
    gy: accG?.y ?? null,
    gz: accG?.z ?? null,
    dtSec,
  });
});

window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
  // Only use orientation Euler deltas if rotationRate from devicemotion is unavailable
  if (hasMotionEvents) {
    return;
  }
  sensorState = stepCrosshairFromOrientation(sensorState, {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
  });
});

// Pointer / mouse fallback for desktop testing and bottom HUD center reset tap
function updateCrosshairFromPointer(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  const logicalX = ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
  const logicalY = ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;

  if (logicalY >= 356) {
    sensorState = resetCenter(sensorState);
    return;
  }

  sensorState = {
    ...sensorState,
    crosshair: clampPoint({ x: logicalX, y: logicalY }, PLAYFIELD_BOUNDS),
  };
}

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (shouldApplyPointerFallback(hasMotionEvents, e.pointerType, e.buttons)) {
    updateCrosshairFromPointer(e.clientX, e.clientY);
  }
});

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  if (rect.height > 0 && ((e.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT >= 356) {
    sensorState = resetCenter(sensorState);
    return;
  }
  if (shouldApplyPointerFallback(hasMotionEvents, e.pointerType, 1)) {
    updateCrosshairFromPointer(e.clientX, e.clientY);
  }
});

resetCenterBtn.addEventListener('click', () => {
  sensorState = resetCenter(sensorState);
});

async function beginGameRun(): Promise<void> {
  if (isStartingRun) {
    return;
  }
  isStartingRun = true;
  startBtn.disabled = true;
  retryBtn.disabled = true;
  try {
    audio.unlock();
    await requestSensorPermissionsIfNeeded();
    lastMotionTimestampMs = null;
    sensorState = resetCenter(sensorState);
    gameState = startCountdown(gameState, sensorState.crosshair);
    for (const ev of gameState.audioEvents) {
      audio.play(ev);
    }
    titleOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
  } finally {
    isStartingRun = false;
    startBtn.disabled = false;
    retryBtn.disabled = false;
  }
}

startBtn.addEventListener('click', () => {
  void beginGameRun();
});

retryBtn.addEventListener('click', () => {
  void beginGameRun();
});

shareBtn.addEventListener('click', () => {
  if (latestResultData && latestResultBlob) {
    void shareResult(latestResultData, latestResultBlob);
  }
});

async function handleEnterResult(state: typeof gameState): Promise<void> {
  if (state.bestTimeMs !== null && state.isNewRecord) {
    saveBestTime(state.bestTimeMs);
  }
  const data: ResultCardData = {
    clearTimeMs: state.elapsedMs,
    bestTimeMs: state.bestTimeMs ?? state.elapsedMs,
    isNewRecord: state.isNewRecord,
    fullTrace: state.fullTrace,
  };
  latestResultData = data;
  resultHeading.textContent = state.isNewRecord
    ? `NEW RECORD! ${formatTimeSeconds(state.elapsedMs)}s`
    : `CLEAR! ${formatTimeSeconds(state.elapsedMs)}s`;

  try {
    const { blob, dataUrl } = await generateResultCardBlob(data);
    latestResultBlob = blob;
    resultCardImg.src = dataUrl;
    downloadLink.href = dataUrl;
  } catch {
    // Ignore image generation failure in non-canvas environments
  }
  resultOverlay.classList.remove('hidden');
}

let lastFrameTimeMs = performance.now();

function frameLoop(nowMs: number): void {
  const dtMs = nowMs - lastFrameTimeMs;
  lastFrameTimeMs = nowMs;

  const prevPhase = gameState.phase;
  gameState = stepGame(gameState, sensorState.crosshair, dtMs, DEFAULT_WAVES);

  for (const ev of gameState.audioEvents) {
    audio.play(ev);
  }

  if (prevPhase !== 'RESULT' && gameState.phase === 'RESULT') {
    void handleEnterResult(gameState);
  }

  renderGame(ctx, gameState, DEFAULT_WAVES.length);
  requestAnimationFrame(frameLoop);
}

renderGame(ctx, gameState, DEFAULT_WAVES.length);
requestAnimationFrame(frameLoop);
