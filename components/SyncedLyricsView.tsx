'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  buildLineWords,
  computeProgressiveBlurPx,
  computeWordAnimationFrame,
  findActiveLyricIndexWithOffset,
} from '@/lib/metrolist/lyricsEngine';
import type {
  LyricLine,
  LyricsAnimationStyle,
  LyricsTextPosition,
} from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

export interface SyncedLyricsViewProps {
  lines: LyricLine[];
  currentTime: number;
  isPlaying: boolean;
  playbackRate?: number;
  animationStyle: LyricsAnimationStyle;
  textPosition: LyricsTextPosition;
  fontSize: number;
  lineSpacing: number;
  progressiveBlur: boolean;
  neutralColor: boolean;
  clickToSeek: boolean;
  autoScroll: boolean;
  globalOffsetMs: number;
  onSeek?: (seconds: number) => void;
  onOffsetChange?: (nextOffsetMs: number) => void;
  showOffsetBar?: boolean;
  compact?: boolean;
}

const ALIGN_CLASSES: Record<LyricsTextPosition, string> = {
  LEFT: 'text-left justify-start',
  CENTER: 'text-center justify-center',
  RIGHT: 'text-right justify-end',
};

const TEXT_ALIGN_ONLY: Record<LyricsTextPosition, string> = {
  LEFT: 'text-left',
  CENTER: 'text-center',
  RIGHT: 'text-right',
};

/**
 * Full word-level synced lyrics renderer matching Metrolist's 5 official styles
 * (APPLE, BRACCATO, EXPRESSIVE, SIMPLE, NONE), smooth 60fps interpolated playhead,
 * progressive depth-of-field blur (auto-clearing on manual scroll), alignment,
 * tap-to-seek, auto-scroll with Resume Sync pill, and live ±100ms timing offset.
 */
export function SyncedLyricsView({
  lines,
  currentTime,
  isPlaying,
  playbackRate = 1,
  animationStyle,
  textPosition,
  fontSize,
  lineSpacing,
  progressiveBlur,
  neutralColor,
  clickToSeek,
  autoScroll,
  globalOffsetMs,
  onSeek,
  onOffsetChange,
  showOffsetBar = true,
  compact = false,
}: SyncedLyricsViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const manualScrollTimerRef = useRef<number | null>(null);
  const hasInitialScrolledRef = useRef(false);

  const [isManualScrolling, setIsManualScrolling] = useState(false);

  // Smooth 60fps interpolated playhead between YouTube player 250ms ticks
  const [rafTime, setRafTime] = useState<number | null>(null);
  const anchorTimeRef = useRef(currentTime);
  const anchorPerfRef = useRef(0);

  useEffect(() => {
    anchorTimeRef.current = currentTime;
    anchorPerfRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying || animationStyle === 'NONE') return;
    let rafId = 0;
    const step = (now: number) => {
      const elapsedSec = Math.max(0, (now - anchorPerfRef.current) / 1000);
      // Cap drift to 0.9s between player sync pulses
      const next = anchorTimeRef.current + Math.min(elapsedSec, 0.9) * playbackRate;
      setRafTime(next);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, animationStyle, playbackRate]);

  const smoothTime =
    isPlaying && animationStyle !== 'NONE' && rafTime !== null && Math.abs(rafTime - currentTime) < 1.2
      ? rafTime
      : currentTime;

  // Pre-build word spans for all lines once when lines change
  const linesWithWords = useMemo(
    () =>
      lines.map((line, idx) => ({
        line,
        words: buildLineWords(
          line,
          idx < lines.length - 1 ? lines[idx + 1].timeSec : null
        ),
      })),
    [lines]
  );

  // Reset initial-scroll latch when a brand new song's lyrics load
  useEffect(() => {
    hasInitialScrolledRef.current = false;
  }, [lines]);

  const effectiveTimeSec = smoothTime + globalOffsetMs / 1000;
  const activeIndex = useMemo(
    () => findActiveLyricIndexWithOffset(lines, smoothTime, globalOffsetMs),
    [lines, smoothTime, globalOffsetMs]
  );

  // Auto-scroll active line cleanly to visual center unless user is manually scrolling
  useEffect(() => {
    if (!autoScroll || isManualScrolling || activeIndex < 0) return;
    const container = scrollContainerRef.current;
    const target = lineRefs.current[activeIndex];
    if (!container || !target) return;

    const targetTop =
      target.offsetTop -
      container.clientHeight * (compact ? 0.34 : 0.42) +
      target.clientHeight / 2;
    const behavior: ScrollBehavior = hasInitialScrolledRef.current
      ? 'smooth'
      : 'instant';
    hasInitialScrolledRef.current = true;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior,
    });
  }, [activeIndex, autoScroll, isManualScrolling, compact]);

  // Only treat genuine user wheel/touch drag gestures as manual scrolling (never programmatic scrollTo)
  const markManualScroll = () => {
    setIsManualScrolling(true);
    if (manualScrollTimerRef.current) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
    // Automatically resume sync after 4.5s of scroll inactivity (Metrolist pattern)
    manualScrollTimerRef.current = window.setTimeout(() => {
      setIsManualScrolling(false);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (manualScrollTimerRef.current) {
        window.clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

  const handleResumeSync = () => {
    setIsManualScrolling(false);
    if (manualScrollTimerRef.current) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
  };

  const clampOffset = (val: number) => Math.max(-2000, Math.min(2000, val));

  return (
    <div
      data-testid="synced-lyrics-view"
      data-lyrics-style={animationStyle}
      data-lyrics-align={textPosition}
      className="relative flex-1 min-h-0 flex flex-col"
    >
      {/* Inline Timing Offset Bar (Metrolist ±100ms live sync adjuster) */}
      {showOffsetBar && onOffsetChange && (
        <div className="shrink-0 flex items-center justify-center gap-2 pb-2.5">
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full metro-surface text-xs">
            <span className="pl-1.5 pr-1 text-[11px] font-medium opacity-65">
              Sync
            </span>
            <button
              type="button"
              onClick={() => onOffsetChange(clampOffset(globalOffsetMs - 100))}
              aria-label="Delay lyrics by 100ms"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span
              data-testid="lyrics-offset-readout"
              className="min-w-[54px] text-center font-mono-nums font-semibold text-[11.5px]"
            >
              {globalOffsetMs > 0 ? `+${globalOffsetMs}` : globalOffsetMs}ms
            </span>
            <button
              type="button"
              onClick={() => onOffsetChange(clampOffset(globalOffsetMs + 100))}
              aria-label="Advance lyrics by 100ms"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            {globalOffsetMs !== 0 && (
              <button
                type="button"
                onClick={() => onOffsetChange(0)}
                aria-label="Reset lyrics timing offset"
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--m3-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable Synced Lyrics Canvas */}
      <div
        ref={scrollContainerRef}
        onWheel={markManualScroll}
        onTouchMove={markManualScroll}
        className={cn(
          'relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar',
          compact
            ? 'px-3 py-3 space-y-2'
            : 'px-3 sm:px-6 pt-[22vh] pb-[42vh] space-y-3'
        )}
        style={{
          maskImage:
            'linear-gradient(180deg, transparent 0%, black 10%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, black 10%, black 88%, transparent 100%)',
        }}
      >
        {linesWithWords.map(({ line, words }, idx) => {
          const isActive = idx === activeIndex;
          const isPast = activeIndex >= 0 && idx < activeIndex;
          const blurPx = computeProgressiveBlurPx({
            lineIndex: idx,
            activeIndex,
            enabled: progressiveBlur,
            isManualScrolling,
          });

          const activeColor = neutralColor
            ? 'var(--lyrics-neutral-active)'
            : 'var(--m3-primary)';
          const inactiveColor = neutralColor
            ? 'var(--lyrics-neutral-inactive)'
            : 'var(--lyrics-theme-inactive)';

          return (
            <button
              key={`${line.timeSec}-${idx}`}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              type="button"
              disabled={!clickToSeek || !onSeek}
              onClick={() => {
                if (clickToSeek && onSeek) {
                  onSeek(Math.max(0, line.timeSec - globalOffsetMs / 1000));
                  handleResumeSync();
                }
              }}
              className={cn(
                'block w-full rounded-2xl px-3 py-1.5 transition-[filter,opacity,transform] duration-300',
                TEXT_ALIGN_ONLY[textPosition],
                clickToSeek && onSeek
                  ? 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                  : 'cursor-default'
              )}
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineSpacing,
                filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                opacity: isActive ? 1 : isPast ? 0.48 : 0.56,
              }}
            >
              <span
                className={cn(
                  'inline-flex flex-wrap gap-x-[0.26em] gap-y-[0.06em] font-display font-bold tracking-tight w-full',
                  ALIGN_CLASSES[textPosition]
                )}
              >
                {words.map((word, wIdx) => {
                  const frame = computeWordAnimationFrame({
                    style: animationStyle,
                    wordStartSec: word.startSec,
                    wordEndSec: word.endSec,
                    currentTimeSec: effectiveTimeSec,
                    isActiveLine: isActive,
                  });

                  const fillPct = Math.round(frame.fillProgress * 1000) / 10;
                  const softEdgePct = Math.min(100, fillPct + 8);
                  const hasGradientSweep =
                    isActive && animationStyle !== 'NONE';

                  return (
                    <span
                      key={`${idx}-${wIdx}`}
                      className="inline-block will-change-transform"
                      style={{
                        transform:
                          isActive && (frame.liftEm !== 0 || frame.scale !== 1)
                            ? `translateY(${frame.liftEm.toFixed(4)}em) scale(${frame.scale.toFixed(3)})`
                            : 'translateY(0em) scale(1)',
                        color: hasGradientSweep
                          ? 'transparent'
                          : isActive
                            ? activeColor
                            : inactiveColor,
                        backgroundImage: hasGradientSweep
                          ? `linear-gradient(90deg, ${activeColor} 0%, ${activeColor} ${fillPct}%, ${inactiveColor} ${softEdgePct}%, ${inactiveColor} 100%)`
                          : undefined,
                        WebkitBackgroundClip: hasGradientSweep ? 'text' : undefined,
                        backgroundClip: hasGradientSweep ? 'text' : undefined,
                        textShadow:
                          frame.glowAlpha > 0.03
                            ? `0 0 ${Math.round(14 * frame.glowAlpha)}px color-mix(in srgb, ${activeColor} ${Math.round(frame.glowAlpha * 58)}%, transparent)`
                            : undefined,
                      }}
                    >
                      {word.text}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Resume Sync button when user scrolls away */}
      {isManualScrolling && autoScroll && !compact && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={handleResumeSync}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold shadow-lg hover:scale-105 transition-transform"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Resume Sync</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive 12-second looping live lyrics preview card rendered inside Settings -> Lyrics
 * (ported from Metrolist's `LyricsSettingsPreview.kt`) so every style, alignment,
 * font size, line spacing, and progressive blur change is immediately visible live.
 */
const DEMO_PREVIEW_LINES: LyricLine[] = [
  { timeSec: 0.0, endTimeSec: 2.8, text: 'Midnight neon glowing on the avenue' },
  { timeSec: 3.0, endTimeSec: 5.9, text: 'Every single melody drifts back to you' },
  { timeSec: 6.1, endTimeSec: 9.0, text: 'Floating through the rhythm in liquid light' },
  { timeSec: 9.2, endTimeSec: 12.0, text: 'Hold the quiet echo into the night' },
];

export function LyricsSettingsPreview({
  animationStyle,
  textPosition,
  fontSize,
  lineSpacing,
  progressiveBlur,
  neutralColor,
}: {
  animationStyle: LyricsAnimationStyle;
  textPosition: LyricsTextPosition;
  fontSize: number;
  lineSpacing: number;
  progressiveBlur: boolean;
  neutralColor: boolean;
}) {
  const [demoTime, setDemoTime] = useState(3.8);

  useEffect(() => {
    let rafId = 0;
    const startPerf = performance.now();
    const initialOffset = 3.2;

    const tick = (now: number) => {
      const elapsedSec = (now - startPerf) / 1000;
      setDemoTime((initialOffset + elapsedSec) % 12);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Scale preview font slightly so compact card stays legible on 360px phones
  const previewFontSize = Math.max(15, Math.min(24, Math.round(fontSize * 0.78)));

  return (
    <div
      data-testid="lyrics-settings-preview"
      data-lyrics-style={animationStyle}
      data-lyrics-align={textPosition}
      className="relative rounded-[22px] overflow-hidden border border-black/[0.08] dark:border-white/[0.10] h-[196px] flex flex-col"
      style={{
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--m3-primary) 22%, var(--m3-surface)) 0%, var(--m3-surface) 78%)',
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--m3-primary)]">
          Live Preview · {animationStyle}
        </span>
        <span className="text-[11px] opacity-60 font-mono-nums">
          {fontSize}px · {lineSpacing.toFixed(2)}×
        </span>
      </div>

      <SyncedLyricsView
        lines={DEMO_PREVIEW_LINES}
        currentTime={demoTime}
        isPlaying={true}
        animationStyle={animationStyle}
        textPosition={textPosition}
        fontSize={previewFontSize}
        lineSpacing={lineSpacing}
        progressiveBlur={progressiveBlur}
        neutralColor={neutralColor}
        clickToSeek={false}
        autoScroll={true}
        globalOffsetMs={0}
        showOffsetBar={false}
        compact={true}
      />
    </div>
  );
}
