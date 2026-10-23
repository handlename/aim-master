import { Point, segmentCircleIntersect } from './geometry';
import { PLAYFIELD_CENTER } from './sensor';
import {
  DEFAULT_WAVES,
  TargetBlueprint,
  WaveDefinition,
  evaluateTargetPosition,
} from './waves';

export type GamePhase = 'TITLE' | 'COUNTDOWN' | 'PLAYING' | 'RESULT';

export type GameAudioEvent =
  | 'COUNTDOWN_TICK'
  | 'COUNTDOWN_GO'
  | 'TARGET_HIT'
  | 'WAVE_CLEAR'
  | 'GAME_CLEAR';

export interface ActiveTarget {
  readonly blueprint: TargetBlueprint;
  readonly position: Point;
  readonly hit: boolean;
}

export interface HitEffect {
  readonly position: Point;
  readonly remainingMs: number;
}

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
  readonly ageMs: number;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly countdownRemainingMs: number;
  readonly waveIndex: number;
  readonly waveElapsedMs: number;
  readonly elapsedMs: number;
  readonly bestTimeMs: number | null;
  readonly isNewRecord: boolean;
  readonly crosshair: Point;
  readonly targets: readonly ActiveTarget[];
  readonly hitEffects: readonly HitEffect[];
  readonly recentTrail: readonly TrailPoint[];
  readonly fullTrace: readonly Point[];
  readonly audioEvents: readonly GameAudioEvent[];
}

export const CROSSHAIR_HIT_RADIUS = 4;
export const COUNTDOWN_DURATION_MS = 1800;

const HIT_EFFECT_DURATION_MS = 220;
const TRAIL_MAX_AGE_MS = 180;
const MAX_FULL_TRACE_POINTS = 600;
const MAX_PLAYING_DT_MS = 50;

function spawnWaveTargets(wave: WaveDefinition): readonly ActiveTarget[] {
  return wave.targets.map((blueprint) => ({
    blueprint,
    position: evaluateTargetPosition(blueprint, 0),
    hit: false,
  }));
}

export function createInitialGameState(bestTimeMs: number | null): GameState {
  return {
    phase: 'TITLE',
    countdownRemainingMs: 0,
    waveIndex: 0,
    waveElapsedMs: 0,
    elapsedMs: 0,
    bestTimeMs,
    isNewRecord: false,
    crosshair: PLAYFIELD_CENTER,
    targets: [],
    hitEffects: [],
    recentTrail: [],
    fullTrace: [],
    audioEvents: [],
  };
}

export function startCountdown(
  state: GameState,
  initialCrosshair: Point = PLAYFIELD_CENTER
): GameState {
  return {
    ...state,
    phase: 'COUNTDOWN',
    countdownRemainingMs: COUNTDOWN_DURATION_MS,
    waveIndex: 0,
    waveElapsedMs: 0,
    elapsedMs: 0,
    isNewRecord: false,
    crosshair: initialCrosshair,
    targets: [],
    hitEffects: [],
    recentTrail: [{ x: initialCrosshair.x, y: initialCrosshair.y, ageMs: 0 }],
    fullTrace: [initialCrosshair],
    audioEvents: ['COUNTDOWN_TICK'],
  };
}

function updateTrail(
  recentTrail: readonly TrailPoint[],
  nextCrosshair: Point,
  dtMs: number
): readonly TrailPoint[] {
  const aged = recentTrail
    .map((pt) => ({ ...pt, ageMs: pt.ageMs + dtMs }))
    .filter((pt) => pt.ageMs <= TRAIL_MAX_AGE_MS);
  return [...aged, { x: nextCrosshair.x, y: nextCrosshair.y, ageMs: 0 }];
}

function evaluateSweptHits(
  targets: readonly ActiveTarget[],
  prevCrosshair: Point,
  nextCrosshair: Point,
  waveElapsedSec: number
): {
  readonly updatedTargets: readonly ActiveTarget[];
  readonly newlyHitPositions: readonly Point[];
} {
  const newlyHitPositions: Point[] = [];
  const updatedTargets = targets.map((target) => {
    const position = evaluateTargetPosition(target.blueprint, waveElapsedSec);
    if (target.hit) {
      return { ...target, position };
    }
    const hitRadius = target.blueprint.radius + CROSSHAIR_HIT_RADIUS;
    const isHit = segmentCircleIntersect(prevCrosshair, nextCrosshair, position, hitRadius);
    if (isHit) {
      newlyHitPositions.push(position);
      return { ...target, position, hit: true };
    }
    return { ...target, position };
  });

  return { updatedTargets, newlyHitPositions };
}

export function stepGame(
  state: GameState,
  nextCrosshair: Point,
  dtMs: number,
  waves: readonly WaveDefinition[] = DEFAULT_WAVES
): GameState {
  if (state.phase === 'TITLE' || state.phase === 'RESULT') {
    return {
      ...state,
      crosshair: nextCrosshair,
      recentTrail: updateTrail(state.recentTrail, nextCrosshair, Math.min(50, Math.max(0, dtMs))),
      audioEvents: [],
    };
  }

  if (state.phase === 'COUNTDOWN') {
    const safeDt = Math.max(0, dtMs);
    const prevBucket = Math.ceil(state.countdownRemainingMs / 600);
    const nextRemaining = state.countdownRemainingMs - safeDt;
    const nextBucket = Math.ceil(Math.max(0, nextRemaining) / 600);
    const audioEvents: GameAudioEvent[] = [];

    if (nextRemaining > 0) {
      if (nextBucket < prevBucket && nextBucket >= 1) {
        audioEvents.push('COUNTDOWN_TICK');
      }
      return {
        ...state,
        countdownRemainingMs: nextRemaining,
        crosshair: nextCrosshair,
        recentTrail: updateTrail(state.recentTrail, nextCrosshair, Math.min(50, safeDt)),
        audioEvents,
      };
    }

    // Transition to PLAYING on Wave 0
    audioEvents.push('COUNTDOWN_GO');
    const firstWave = waves[0];
    const initialTargets = firstWave ? spawnWaveTargets(firstWave) : [];
    const { updatedTargets, newlyHitPositions } = evaluateSweptHits(
      initialTargets,
      nextCrosshair,
      nextCrosshair,
      0
    );

    if (newlyHitPositions.length > 0) {
      audioEvents.push('TARGET_HIT');
    }

    const hitEffects: HitEffect[] = newlyHitPositions.map((position) => ({
      position,
      remainingMs: HIT_EFFECT_DURATION_MS,
    }));

    const allHit = updatedTargets.length > 0 && updatedTargets.every((t) => t.hit);
    if (allHit && waves.length > 1) {
      audioEvents.push('WAVE_CLEAR');
      return {
        ...state,
        phase: 'PLAYING',
        countdownRemainingMs: 0,
        waveIndex: 1,
        waveElapsedMs: 0,
        elapsedMs: 0,
        crosshair: nextCrosshair,
        targets: spawnWaveTargets(waves[1]),
        hitEffects,
        recentTrail: updateTrail(state.recentTrail, nextCrosshair, 16),
        fullTrace: [nextCrosshair],
        audioEvents,
      };
    }

    return {
      ...state,
      phase: 'PLAYING',
      countdownRemainingMs: 0,
      waveIndex: 0,
      waveElapsedMs: 0,
      elapsedMs: 0,
      crosshair: nextCrosshair,
      targets: updatedTargets,
      hitEffects,
      recentTrail: updateTrail(state.recentTrail, nextCrosshair, 16),
      fullTrace: [nextCrosshair],
      audioEvents,
    };
  }

  // state.phase === 'PLAYING'
  const clampedDt = Math.min(MAX_PLAYING_DT_MS, Math.max(0, dtMs));
  const nextElapsedMs = state.elapsedMs + clampedDt;
  const nextWaveElapsedMs = state.waveElapsedMs + clampedDt;
  const waveElapsedSec = nextWaveElapsedMs / 1000;

  const { updatedTargets, newlyHitPositions } = evaluateSweptHits(
    state.targets,
    state.crosshair,
    nextCrosshair,
    waveElapsedSec
  );

  const audioEvents: GameAudioEvent[] = [];
  if (newlyHitPositions.length > 0) {
    audioEvents.push('TARGET_HIT');
  }

  const agedEffects = state.hitEffects
    .map((ef) => ({ ...ef, remainingMs: ef.remainingMs - clampedDt }))
    .filter((ef) => ef.remainingMs > 0);
  const hitEffects: readonly HitEffect[] = [
    ...agedEffects,
    ...newlyHitPositions.map((position) => ({
      position,
      remainingMs: HIT_EFFECT_DURATION_MS,
    })),
  ];

  const nextTrail = updateTrail(state.recentTrail, nextCrosshair, clampedDt);
  const nextFullTrace =
    state.fullTrace.length < MAX_FULL_TRACE_POINTS
      ? [...state.fullTrace, nextCrosshair]
      : state.fullTrace;

  const allCleared = updatedTargets.length > 0 && updatedTargets.every((t) => t.hit);
  if (!allCleared) {
    return {
      ...state,
      elapsedMs: nextElapsedMs,
      waveElapsedMs: nextWaveElapsedMs,
      crosshair: nextCrosshair,
      targets: updatedTargets,
      hitEffects,
      recentTrail: nextTrail,
      fullTrace: nextFullTrace,
      audioEvents,
    };
  }

  const nextWaveIndex = state.waveIndex + 1;
  if (nextWaveIndex < waves.length) {
    audioEvents.push('WAVE_CLEAR');
    return {
      ...state,
      waveIndex: nextWaveIndex,
      waveElapsedMs: 0,
      elapsedMs: nextElapsedMs,
      crosshair: nextCrosshair,
      targets: spawnWaveTargets(waves[nextWaveIndex]),
      hitEffects,
      recentTrail: nextTrail,
      fullTrace: nextFullTrace,
      audioEvents,
    };
  }

  // Final wave cleared -> RESULT
  audioEvents.push('GAME_CLEAR');
  const isNewRecord = state.bestTimeMs === null || nextElapsedMs < state.bestTimeMs;
  const nextBestTimeMs = isNewRecord ? nextElapsedMs : state.bestTimeMs;

  return {
    ...state,
    phase: 'RESULT',
    elapsedMs: nextElapsedMs,
    waveElapsedMs: nextWaveElapsedMs,
    bestTimeMs: nextBestTimeMs,
    isNewRecord,
    crosshair: nextCrosshair,
    targets: updatedTargets,
    hitEffects,
    recentTrail: nextTrail,
    fullTrace: nextFullTrace,
    audioEvents,
  };
}
