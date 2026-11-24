'use client';

import React, { useEffect, useRef, useState } from 'react';
import { buildSquigglyWavePath } from '@/lib/metrolist/lyricsEngine';
import type { SliderStyle } from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

interface PlayerSliderProps {
  style: SliderStyle;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * Authentic multi-style playback progress slider ported from Metrolist's
 * `PlaybackProgressSlider.kt` & `SquigglyProgress.kt`:
 * - SQUIGGLY: Smooth sinusoidal wave flattening over 550ms when paused/scrubbing,
 *   rising over 800ms when playing, with a vertical 4x16px rounded pill thumb.
 * - WAVY: Material 3 wavy active track with an 8px circular thumb and crisp track gap.
 * - SLIM: Ultra-clean 3px minimal precision bar.
 * - DEFAULT: Classic rounded Material 3 progress slider.
 */
export function PlayerSlider({
  style,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  className,
}: PlayerSliderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  const [width, setWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(currentTime);

  const safeDuration = Math.max(1, duration);
  const displayTime = isDragging ? dragValue : Math.min(currentTime, safeDuration);
  const playedFraction = Math.max(0, Math.min(1, displayTime / safeDuration));

  // Refs for smooth 60fps SVG path updates without causing React re-renders per frame
  const playedRef = useRef(playedFraction);
  const widthRef = useRef(width);
  const activeWaveRef = useRef(isPlaying && !isDragging);
  const styleRef = useRef(style);
  const amplitudeRef = useRef(isPlaying && !isDragging ? 1 : 0);
  const phaseRef = useRef(0);

  useEffect(() => {
    playedRef.current = playedFraction;
  }, [playedFraction]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    activeWaveRef.current = isPlaying && !isDragging;
  }, [isPlaying, isDragging]);

  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  // Measure container width dynamically so SVG wave wavelengths remain physically accurate
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 16) setWidth(rect.width);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 60fps imperative SVG path animator for SQUIGGLY & WAVY modes
  useEffect(() => {
    if (style !== 'SQUIGGLY' && style !== 'WAVY') return;

    let rafId = 0;
    let lastTs = performance.now();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const strokeWidth = style === 'SQUIGGLY' ? 3.5 : 4;
    const centerY = 12;

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      const targetAmp = activeWaveRef.current && !reducedMotion ? 1 : 0;
      // Metrolist timings: 800ms rise when playing, 550ms flatten when paused/dragging
      const speed = targetAmp > amplitudeRef.current ? 1 / 0.8 : 1 / 0.55;
      if (Math.abs(targetAmp - amplitudeRef.current) > 0.002) {
        const step = dtSec * speed;
        amplitudeRef.current =
          targetAmp > amplitudeRef.current
            ? Math.min(targetAmp, amplitudeRef.current + step)
            : Math.max(targetAmp, amplitudeRef.current - step);
      } else {
        amplitudeRef.current = targetAmp;
      }

      if (amplitudeRef.current > 0.01 && !reducedMotion) {
        // Phase speed tuned to Metrolist's gentle horizontal wave flow
        const waveHz = styleRef.current === 'SQUIGGLY' ? 0.55 : 0.42;
        phaseRef.current = (phaseRef.current + dtSec * waveHz) % 1;
      }

      const pathEl = pathRef.current;
      if (pathEl) {
        const d = buildSquigglyWavePath({
          width: widthRef.current,
          centerY,
          playedFraction: playedRef.current,
          amplitudeFraction:
            styleRef.current === 'WAVY'
              ? amplitudeRef.current * 0.72
              : amplitudeRef.current,
          phaseFraction: phaseRef.current,
          strokeWidth,
        });
        pathEl.setAttribute('d', d);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [style]);

  // Initial SSR/first-frame path for SQUIGGLY / WAVY so it never flashes blank
  const initialWavePath =
    style === 'SQUIGGLY' || style === 'WAVY'
      ? buildSquigglyWavePath({
          width,
          centerY: 12,
          playedFraction,
          amplitudeFraction: isPlaying && !isDragging ? (style === 'WAVY' ? 0.72 : 1) : 0,
          phaseFraction: 0,
          strokeWidth: style === 'SQUIGGLY' ? 3.5 : 4,
        })
      : '';

  const pct = playedFraction * 100;

  return (
    <div
      ref={containerRef}
      data-testid="player-slider"
      data-slider-style={style}
      className={cn('relative w-full h-7 flex items-center select-none', className)}
    >
      {/* Visual Track Layer */}
      {style === 'SQUIGGLY' || style === 'WAVY' ? (
        <div className="relative w-full h-6 flex items-center pointer-events-none">
          <svg
            width={width}
            height={24}
            viewBox={`0 0 ${width} 24`}
            className="w-full h-6 overflow-visible"
            aria-hidden="true"
          >
            {/* Inactive Remaining Track */}
            <line
              x1={Math.min(width - 2, Math.max(2, width * playedFraction + (style === 'WAVY' ? 7 : 5)))}
              y1={12}
              x2={width - 2}
              y2={12}
              stroke="currentColor"
              strokeWidth={style === 'SQUIGGLY' ? 3 : 3.5}
              strokeLinecap="round"
              className="text-black/15 dark:text-white/20"
            />
            {/* Active Sinusoidal Wave Path */}
            <path
              ref={pathRef}
              d={initialWavePath}
              fill="none"
              stroke="var(--m3-primary)"
              strokeWidth={style === 'SQUIGGLY' ? 3.5 : 4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Thumb */}
          {style === 'SQUIGGLY' ? (
            /* Metrolist SquigglyProgress vertical rounded pill thumb (4x16px) */
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--m3-primary)] shadow-md transition-transform duration-150',
                isDragging ? 'w-[5px] h-[20px] scale-110' : 'w-[4px] h-[16px]'
              )}
              style={{ left: `${pct}%` }}
            />
          ) : (
            /* Material 3 WavyProgress circular thumb with crisp halo */
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--m3-primary)] shadow-md ring-2 ring-[var(--m3-bg)] transition-transform duration-150',
                isDragging ? 'w-4 h-4 scale-110' : 'w-3 h-3'
              )}
              style={{ left: `${pct}%` }}
            />
          )}
        </div>
      ) : style === 'SLIM' ? (
        /* Slim minimal 3px precision bar */
        <div className="relative w-full h-[3px] rounded-full bg-black/15 dark:bg-white/20 pointer-events-none">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--m3-primary)]"
            style={{ width: `${pct}%` }}
          />
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--m3-primary)] transition-all duration-150',
              isDragging ? 'w-3 h-3 opacity-100' : 'w-2 h-2 opacity-85'
            )}
            style={{ left: `${pct}%` }}
          />
        </div>
      ) : (
        /* DEFAULT: Classic Material 3 rounded bar with pill thumb */
        <div className="relative w-full h-1.5 rounded-full bg-black/15 dark:bg-white/20 pointer-events-none">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--m3-primary)]"
            style={{ width: `${pct}%` }}
          />
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--m3-primary)] shadow-md transition-transform duration-150',
              isDragging ? 'w-4 h-4 scale-110' : 'w-3.5 h-3.5'
            )}
            style={{ left: `${pct}%` }}
          />
        </div>
      )}

      {/* Accessible native range overlay for seamless touch, mouse drag & keyboard scrub */}
      <input
        type="range"
        min={0}
        max={safeDuration}
        step={0.5}
        value={displayTime}
        aria-label="Seek playback position"
        onPointerDown={() => {
          setIsDragging(true);
          setDragValue(currentTime);
        }}
        onPointerUp={() => {
          if (isDragging) {
            onSeek(dragValue);
            setIsDragging(false);
          }
        }}
        onPointerCancel={() => setIsDragging(false)}
        onChange={(e) => {
          const val = Number(e.target.value);
          setDragValue(val);
          onSeek(val);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
      />
    </div>
  );
}
