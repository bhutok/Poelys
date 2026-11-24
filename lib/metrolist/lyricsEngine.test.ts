import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLineWords,
  buildSquigglyWavePath,
  computeExperimentalWordWobble,
  computeProgressiveBlurPx,
  computeWordAnimationFrame,
  findActiveLyricIndexWithOffset,
} from './lyricsEngine';
import type { LyricLine } from './types';

test('buildLineWords parses enhanced <mm:ss.xx> word timestamps and synthesizes weights for standard LRC', () => {
  const enhanced: LyricLine = {
    timeSec: 10,
    text: '<00:10.00>Hello <00:10.60>world <00:11.20>tonight',
  };
  const enhancedWords = buildLineWords(enhanced, 13);
  assert.equal(enhancedWords.length, 3);
  assert.equal(enhancedWords[0].text, 'Hello');
  assert.equal(enhancedWords[0].startSec, 10);
  assert.equal(enhancedWords[1].startSec, 10.6);
  assert.equal(enhancedWords[2].text, 'tonight');

  const standard: LyricLine = {
    timeSec: 20,
    text: 'Blinding lights shine bright',
  };
  const synthWords = buildLineWords(standard, 24);
  assert.equal(synthWords.length, 4);
  assert.equal(synthWords[0].startSec, 20);
  assert.ok(synthWords[3].endSec <= 24);
  assert.ok(synthWords[0].endSec > synthWords[0].startSec);
});

test('findActiveLyricIndexWithOffset shifts active lyric line accurately with globalOffsetMs', () => {
  const lines: LyricLine[] = [
    { timeSec: 5, text: 'Line 1' },
    { timeSec: 10, text: 'Line 2' },
    { timeSec: 15, text: 'Line 3' },
  ];

  assert.equal(findActiveLyricIndexWithOffset(lines, 9.5, 0), 0);
  // +800ms offset advances timing earlier -> hits Line 2 at 9.5s (effective 10.3s)
  assert.equal(findActiveLyricIndexWithOffset(lines, 9.5, 800), 1);
  // -1000ms offset delays timing -> still Line 1 at 10.5s (effective 9.5s)
  assert.equal(findActiveLyricIndexWithOffset(lines, 10.5, -1000), 0);
});

test('Metrolist 5 word animation styles compute distinct physics (Apple, Braccato, Expressive, Simple, None)', () => {
  const base = {
    wordStartSec: 10,
    wordEndSec: 11,
    currentTimeSec: 10.35,
    isActiveLine: true,
  };

  const apple = computeWordAnimationFrame({ ...base, style: 'APPLE' });
  const braccato = computeWordAnimationFrame({ ...base, style: 'BRACCATO' });
  const expressive = computeWordAnimationFrame({ ...base, style: 'EXPRESSIVE' });
  const simple = computeWordAnimationFrame({ ...base, style: 'SIMPLE' });
  const none = computeWordAnimationFrame({ ...base, style: 'NONE' });

  // Apple has gentle lift & glow
  assert.ok(apple.fillProgress > 0.3 && apple.fillProgress < 0.4);
  assert.ok(apple.liftEm < 0 && apple.glowAlpha > 0);

  // Braccato has strong wave peak & emphasis scale > 1.05
  assert.ok(braccato.liftEm < apple.liftEm);
  assert.ok(braccato.scale > 1.05);

  // Expressive wobble peaks at 125ms and decays over 625ms
  assert.equal(computeExperimentalWordWobble(10, 10.125), 1);
  assert.ok(expressive.scale > 1.04 && expressive.glowAlpha > 0.4);

  // Simple fills horizontally without lift or scale
  assert.equal(simple.liftEm, 0);
  assert.equal(simple.scale, 1);
  assert.ok(simple.fillProgress > 0.3);

  // None highlights instantaneously with zero lift
  assert.equal(none.fillProgress, 1);
  assert.equal(none.liftEm, 0);
});

test('computeProgressiveBlurPx blurs distant lines progressively and clears on active line or manual scroll', () => {
  assert.equal(
    computeProgressiveBlurPx({ lineIndex: 3, activeIndex: 3, enabled: true, isManualScrolling: false }),
    0
  );
  const near = computeProgressiveBlurPx({ lineIndex: 4, activeIndex: 3, enabled: true, isManualScrolling: false });
  const far = computeProgressiveBlurPx({ lineIndex: 7, activeIndex: 3, enabled: true, isManualScrolling: false });
  assert.ok(near > 0 && far > near);

  // Manual scroll or disabled immediately clears blur
  assert.equal(
    computeProgressiveBlurPx({ lineIndex: 7, activeIndex: 3, enabled: true, isManualScrolling: true }),
    0
  );
  assert.equal(
    computeProgressiveBlurPx({ lineIndex: 7, activeIndex: 3, enabled: false, isManualScrolling: false }),
    0
  );
});

test('buildSquigglyWavePath outputs flat line when paused (amplitude 0) and sinusoidal SVG path when playing', () => {
  const flat = buildSquigglyWavePath({
    width: 300,
    centerY: 16,
    playedFraction: 0.5,
    amplitudeFraction: 0,
    phaseFraction: 0,
    strokeWidth: 4,
  });
  assert.match(flat, /^M 2\.00 16\.00 L 150\.00 16\.00$/);

  const wavy = buildSquigglyWavePath({
    width: 300,
    centerY: 16,
    playedFraction: 0.6,
    amplitudeFraction: 1,
    phaseFraction: 0.25,
    strokeWidth: 4,
  });
  assert.ok(wavy.startsWith('M '));
  assert.ok(wavy.split(' L ').length > 20, 'expected smooth multi-segment wave');
});
