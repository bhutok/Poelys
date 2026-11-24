/**
 * Pure TypeScript lyrics animation, timing, progressive blur, and squiggly wave
 * geometry engine ported directly from Metrolist's Compose Multiplatform codebase:
 * - words/LyricsAnimationStyle.kt (APPLE, BRACCATO, EXPRESSIVE, SIMPLE, NONE)
 * - words/Apple.kt, Braccato.kt, Expressive.kt, Simple.kt
 * - LyricsView.kt (progressive blur, global timing offset)
 * - sliders/SquigglyProgress.kt & sliders/WavyProgress.kt
 */

import type {
  LyricLine,
  LyricWord,
  LyricsAnimationStyle,
} from './types';

// Exact Metrolist word animation constants from Braccato.kt / Expressive.kt / Apple.kt
export const METROLIST_WAVE_MS = 900;
export const METROLIST_WAVE_CREST = 0.4;
export const METROLIST_WAVE_PEAK_EM = -0.05;
export const METROLIST_WAVE_SETTLE_EM = -0.02;
export const METROLIST_WAVE_EMPHASIS_SCALE = 1.11;
export const METROLIST_WOBBLE_LIFT_TO_EM = -0.0375;
export const METROLIST_WOBBLE_ATTACK_MS = 125;
export const METROLIST_WOBBLE_DECAY_MS = 625;
export const METROLIST_GLOW_BLUR_SCALE = 0.85;

// Exact Metrolist SquigglyProgress constants from SquigglyProgress.kt
export const SQUIGGLY_WAVELENGTH_PER_STROKE = 10;
export const SQUIGGLY_AMPLITUDE_PER_STROKE = 0.75;
export const SQUIGGLY_PHASE_SPEED_PER_STROKE = 4;

const ENHANCED_WORD_TAG_REGEX = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function parseTimestampSec(
  minutesStr: string,
  secondsStr: string,
  fracRaw = '0'
): number {
  const minutes = Number(minutesStr);
  const seconds = Number(secondsStr);
  const fracSeconds =
    fracRaw.length === 3
      ? Number(fracRaw) / 1000
      : fracRaw.length === 2
        ? Number(fracRaw) / 100
        : Number(fracRaw) / 10;
  return minutes * 60 + seconds + fracSeconds;
}

/**
 * Splits a lyric line into word-level timing spans.
 * 1) If the line contains enhanced LRC word tags `<mm:ss.xx>word`, parses exact timestamps.
 * 2) Otherwise synthesizes smooth character-weighted word spans across `[lineStart, lineEnd]`
 *    so Apple / Braccato / Expressive / Simple word animations work smoothly on every synced song.
 */
export function buildLineWords(
  line: LyricLine,
  nextLineTimeSec: number | null,
  fallbackDurationSec = 3.8
): LyricWord[] {
  if (line.words && line.words.length > 0) {
    return line.words;
  }

  const lineStart = Math.max(0, line.timeSec);
  const inferredEnd =
    line.endTimeSec !== undefined && line.endTimeSec > lineStart + 0.15
      ? line.endTimeSec
      : nextLineTimeSec !== null && nextLineTimeSec > lineStart + 0.25
        ? Math.min(nextLineTimeSec - 0.05, lineStart + 8.5)
        : lineStart + fallbackDurationSec;
  const lineEnd = Math.max(lineStart + 0.35, inferredEnd);

  // Check for enhanced LRC word tags `<mm:ss.xx>`
  ENHANCED_WORD_TAG_REGEX.lastIndex = 0;
  const tagMatches: Array<{ timeSec: number; index: number; len: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = ENHANCED_WORD_TAG_REGEX.exec(line.text)) !== null) {
    tagMatches.push({
      timeSec: parseTimestampSec(match[1], match[2], match[3]),
      index: match.index,
      len: match[0].length,
    });
  }

  if (tagMatches.length > 0) {
    const words: LyricWord[] = [];
    for (let i = 0; i < tagMatches.length; i++) {
      const curr = tagMatches[i];
      const next = tagMatches[i + 1];
      const rawChunk = line.text
        .slice(curr.index + curr.len, next ? next.index : line.text.length)
        .trim();
      if (!rawChunk) continue;
      const startSec = curr.timeSec;
      const endSec = next
        ? Math.max(startSec + 0.08, next.timeSec)
        : Math.max(startSec + 0.25, lineEnd);
      words.push({ startSec, endSec, text: rawChunk });
    }
    if (words.length > 0) return words;
  }

  // Standard line-synced LRC: distribute timing proportionally by word character weight
  const cleanText = line.text.replace(ENHANCED_WORD_TAG_REGEX, '').trim();
  const tokens = cleanText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const weights = tokens.map((tok) => Math.max(2, tok.length + 1));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  const span = Math.max(0.35, (lineEnd - lineStart) * 0.92);

  let cursor = lineStart;
  return tokens.map((text, idx) => {
    const dur = (weights[idx] / totalWeight) * span;
    const startSec = cursor;
    const endSec = cursor + Math.max(0.12, dur);
    cursor = endSec;
    return { startSec, endSec, text };
  });
}

/**
 * Applies Metrolist's `globalLyricsOffsetMs` (positive = lyrics appear earlier)
 * and binary-searches the active synced lyric index.
 */
export function findActiveLyricIndexWithOffset(
  lines: LyricLine[],
  currentTimeSec: number,
  globalOffsetMs = 0
): number {
  if (lines.length === 0) return -1;
  const effectiveTimeSec = currentTimeSec + globalOffsetMs / 1000;
  if (effectiveTimeSec < lines[0].timeSec - 0.12) return -1;

  let low = 0;
  let high = lines.length - 1;
  let active = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeSec <= effectiveTimeSec + 0.12) {
      active = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return active;
}

/**
 * Port of Metrolist `experimentalWordWobble(word, position)` from `Expressive.kt`:
 * 0..125ms linear rise to 1.0, then 125..750ms smooth decay back to 0.0.
 */
export function computeExperimentalWordWobble(
  wordStartSec: number,
  currentTimeSec: number
): number {
  const timeSinceStartMs = (currentTimeSec - wordStartSec) * 1000;
  if (timeSinceStartMs < 0 || timeSinceStartMs > METROLIST_WOBBLE_ATTACK_MS + METROLIST_WOBBLE_DECAY_MS) {
    return 0;
  }
  if (timeSinceStartMs < METROLIST_WOBBLE_ATTACK_MS) {
    return timeSinceStartMs / METROLIST_WOBBLE_ATTACK_MS;
  }
  return Math.max(
    0,
    1 - (timeSinceStartMs - METROLIST_WOBBLE_ATTACK_MS) / METROLIST_WOBBLE_DECAY_MS
  );
}

export interface WordAnimationFrame {
  /** Horizontal fill sweep 0..1 */
  fillProgress: number;
  /** Vertical float offset in em (negative = upward lift) */
  liftEm: number;
  /** Emphasis scale factor (1.0 = normal) */
  scale: number;
  /** Luminous text glow opacity 0..1 */
  glowAlpha: number;
}

/**
 * Computes per-word visual animation frame matching Metrolist's 5 official styles:
 * - APPLE: smooth horizontal fill + gentle float lift (-0.0375em) + soft glow halo
 * - BRACCATO: expressive wave crest (-0.05em peak, 1.11x emphasis scale, 900ms wave)
 * - EXPRESSIVE: fast-attack wobble bounce (125ms/625ms) + radiant bloom glow
 * - SIMPLE: clean horizontal karaoke fill without bounce
 * - NONE: instant binary active highlight
 */
export function computeWordAnimationFrame(params: {
  style: LyricsAnimationStyle;
  wordStartSec: number;
  wordEndSec: number;
  currentTimeSec: number;
  isActiveLine: boolean;
}): WordAnimationFrame {
  const { style, wordStartSec, wordEndSec, currentTimeSec, isActiveLine } = params;

  if (!isActiveLine) {
    return { fillProgress: 0, liftEm: 0, scale: 1, glowAlpha: 0 };
  }

  if (style === 'NONE') {
    return { fillProgress: 1, liftEm: 0, scale: 1, glowAlpha: 0 };
  }

  const durSec = Math.max(0.12, wordEndSec - wordStartSec);
  const rawProgress = (currentTimeSec - wordStartSec) / durSec;
  const fillProgress = clamp(rawProgress, 0, 1);

  if (style === 'SIMPLE') {
    return {
      fillProgress,
      liftEm: 0,
      scale: 1,
      glowAlpha: 0,
    };
  }

  const elapsedMs = (currentTimeSec - wordStartSec) * 1000;

  if (style === 'APPLE') {
    const smoothFill = easeOutCubic(fillProgress);
    const activePulse =
      rawProgress > 0 && rawProgress < 1.35
        ? Math.sin(clamp(rawProgress / 1.35, 0, 1) * Math.PI)
        : 0;
    const liftEm =
      fillProgress > 0
        ? METROLIST_WOBBLE_LIFT_TO_EM * (0.45 * smoothFill + 0.55 * activePulse)
        : 0;
    const glowAlpha = activePulse * 0.65 * METROLIST_GLOW_BLUR_SCALE;
    return {
      fillProgress,
      liftEm,
      scale: 1 + activePulse * 0.035,
      glowAlpha,
    };
  }

  if (style === 'BRACCATO') {
    // 900ms wave crest peaking at 40% (WAVE_CREST = 0.4), settling smoothly to -0.02em
    const waveT = clamp(elapsedMs / METROLIST_WAVE_MS, 0, 1);
    let liftEm = 0;
    let scale = 1;
    let glowAlpha = 0;

    if (elapsedMs >= 0) {
      if (waveT <= METROLIST_WAVE_CREST) {
        const rise = easeOutCubic(waveT / METROLIST_WAVE_CREST);
        liftEm = METROLIST_WAVE_PEAK_EM * rise;
        scale = 1 + (METROLIST_WAVE_EMPHASIS_SCALE - 1) * rise;
        glowAlpha = rise * 0.8;
      } else {
        const settleT = (waveT - METROLIST_WAVE_CREST) / (1 - METROLIST_WAVE_CREST);
        const easedSettle = easeOutCubic(settleT);
        liftEm =
          METROLIST_WAVE_PEAK_EM +
          (METROLIST_WAVE_SETTLE_EM - METROLIST_WAVE_PEAK_EM) * easedSettle;
        scale =
          METROLIST_WAVE_EMPHASIS_SCALE -
          (METROLIST_WAVE_EMPHASIS_SCALE - 1.01) * easedSettle;
        glowAlpha = 0.8 * (1 - easedSettle * 0.72);
      }
    }

    return {
      fillProgress,
      liftEm,
      scale,
      glowAlpha,
    };
  }

  // EXPRESSIVE: Metrolist's experimentalWordWobble + vivid scale & glow bloom
  const wobble = computeExperimentalWordWobble(wordStartSec, currentTimeSec);
  const liftEm = wobble * METROLIST_WOBBLE_LIFT_TO_EM * 1.45;
  const scale = 1 + wobble * 0.095;
  const glowAlpha = clamp(wobble * 0.95 + (fillProgress > 0 && fillProgress < 1 ? 0.25 : 0), 0, 1);

  return {
    fillProgress,
    liftEm,
    scale,
    glowAlpha,
  };
}

/**
 * Computes Metrolist's progressive depth-of-field blur radius (in CSS px)
 * based on distance from the active lyric line.
 * Automatically returns 0 when disabled, during manual scrolling, or for the active line.
 */
export function computeProgressiveBlurPx(params: {
  lineIndex: number;
  activeIndex: number;
  enabled: boolean;
  isManualScrolling: boolean;
}): number {
  const { lineIndex, activeIndex, enabled, isManualScrolling } = params;
  if (!enabled || isManualScrolling || activeIndex < 0) return 0;
  const dist = Math.abs(lineIndex - activeIndex);
  if (dist === 0) return 0;
  if (dist === 1) return 1.1;
  if (dist === 2) return 2.2;
  if (dist === 3) return 3.4;
  return 4.5;
}

/**
 * Generates an SVG path string for Metrolist's SquigglyProgress / WavyProgress track:
 * Ported from `SquigglyProgress.kt` (`wavelength = strokeWidth * 10`,
 * `amplitude = strokeWidth * 0.75 * amplitudeFraction`, smooth sinusoidal Bezier/polyline).
 */
export function buildSquigglyWavePath(params: {
  width: number;
  centerY: number;
  playedFraction: number;
  amplitudeFraction: number;
  phaseFraction: number;
  strokeWidth: number;
}): string {
  const width = Math.max(8, params.width);
  const strokeWidth = Math.max(2, params.strokeWidth);
  const inset = strokeWidth * 0.5;
  const trackWidth = Math.max(0, width - inset * 2);
  const played = clamp(params.playedFraction, 0, 1);
  const playedX = inset + trackWidth * played;

  if (playedX <= inset + 0.5) {
    return `M ${inset.toFixed(2)} ${params.centerY.toFixed(2)} L ${inset.toFixed(2)} ${params.centerY.toFixed(2)}`;
  }

  const amp =
    strokeWidth *
    SQUIGGLY_AMPLITUDE_PER_STROKE *
    clamp(params.amplitudeFraction, 0, 1);

  if (amp < 0.08) {
    return `M ${inset.toFixed(2)} ${params.centerY.toFixed(2)} L ${playedX.toFixed(2)} ${params.centerY.toFixed(2)}`;
  }

  const wavelength = strokeWidth * SQUIGGLY_WAVELENGTH_PER_STROKE;
  const step = Math.max(2, wavelength / 14);
  const phaseRad = params.phaseFraction * Math.PI * 2;
  const twoPiOverLambda = (Math.PI * 2) / wavelength;

  const points: string[] = [];
  for (let x = inset; x <= playedX; x += step) {
    // Softly taper amplitude near the thumb edge (12px) for a clean join
    const distToEdge = Math.min(x - inset, playedX - x);
    const edgeTaper = clamp(distToEdge / 10, 0.25, 1);
    const y =
      params.centerY +
      Math.sin(x * twoPiOverLambda - phaseRad) * amp * edgeTaper;
    points.push(
      `${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(2)}`
    );
  }

  const endY =
    params.centerY +
    Math.sin(playedX * twoPiOverLambda - phaseRad) * amp * 0.25;
  points.push(`L ${playedX.toFixed(1)} ${endY.toFixed(2)}`);
  return points.join(' ');
}
