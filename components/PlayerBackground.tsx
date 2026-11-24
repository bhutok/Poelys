'use client';

import React from 'react';
import type { PlayerBackgroundStyle, ThemeMode } from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

interface PlayerBackgroundProps {
  style: PlayerBackgroundStyle;
  thumbnail: string;
  isPlaying: boolean;
  theme: ThemeMode;
}

/**
 * Multi-mode Now Playing background renderer ported from Metrolist's
 * `PlayerArtworkBackground.kt`:
 * - BLURRED_ARTWORK: Full-bleed blurred album artwork + balanced contrast scrim
 * - SOLID: Clean distraction-free Material 3 surface
 * - GRADIENT: 3-stop smooth vertical tonal gradient derived from artwork accent
 * - ANIMATED_GRADIENT: Gently breathing phase-shifting gradient wash
 * - LIQUID: Flowing multi-orb liquid artwork aurora mesh
 */
export function PlayerBackground({
  style,
  thumbnail,
  isPlaying,
  theme,
}: PlayerBackgroundProps) {
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      data-testid="player-background"
      data-player-bg={style}
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {style === 'SOLID' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--m3-primary) 7%, var(--m3-bg)) 0%, var(--m3-bg) 55%)',
          }}
        />
      )}

      {style === 'GRADIENT' && (
        <div
          className="absolute inset-0 transition-colors duration-700"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, color-mix(in srgb, var(--m3-primary) 34%, #0B0D12) 0%, color-mix(in srgb, var(--m3-primary) 16%, var(--m3-bg)) 48%, var(--m3-bg) 100%)'
              : 'linear-gradient(180deg, color-mix(in srgb, var(--m3-primary) 24%, #FFFFFF) 0%, color-mix(in srgb, var(--m3-primary) 10%, var(--m3-bg)) 52%, var(--m3-bg) 100%)',
          }}
        />
      )}

      {style === 'ANIMATED_GRADIENT' && (
        <>
          <div
            className={cn(
              'absolute -inset-[25%] player-animated-gradient',
              !isPlaying && 'player-anim-paused'
            )}
            style={{
              backgroundImage: isDark
                ? 'radial-gradient(circle at 22% 18%, color-mix(in srgb, var(--m3-primary) 42%, transparent) 0%, transparent 55%), radial-gradient(circle at 82% 28%, color-mix(in srgb, var(--m3-primary-container) 48%, transparent) 0%, transparent 58%), radial-gradient(circle at 50% 85%, color-mix(in srgb, var(--m3-primary) 26%, transparent) 0%, transparent 60%)'
                : 'radial-gradient(circle at 22% 18%, color-mix(in srgb, var(--m3-primary) 26%, transparent) 0%, transparent 55%), radial-gradient(circle at 82% 28%, color-mix(in srgb, var(--m3-primary-container) 42%, transparent) 0%, transparent 58%), radial-gradient(circle at 50% 85%, color-mix(in srgb, var(--m3-primary) 18%, transparent) 0%, transparent 60%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, color-mix(in srgb, var(--m3-bg) 78%, transparent) 82%, var(--m3-bg) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, color-mix(in srgb, var(--m3-bg) 76%, transparent) 84%, var(--m3-bg) 100%)',
            }}
          />
        </>
      )}

      {style === 'BLURRED_ARTWORK' && (
        <>
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-[42px] saturate-150 opacity-75 transition-opacity duration-500"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, rgba(8,10,14,0.48) 0%, rgba(10,12,16,0.68) 58%, rgba(8,10,14,0.88) 100%)'
                : 'linear-gradient(180deg, rgba(247,248,252,0.58) 0%, rgba(247,248,252,0.78) 60%, rgba(247,248,252,0.94) 100%)',
            }}
          />
        </>
      )}

      {style === 'LIQUID' && (
        <>
          {/* Soft artwork base layer */}
          {thumbnail && (
            <img
              src={thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className={cn(
                'absolute -inset-12 w-[calc(100%+6rem)] h-[calc(100%+6rem)] object-cover blur-[56px] saturate-[1.8] opacity-55 player-liquid-orb-a',
                !isPlaying && 'player-anim-paused'
              )}
            />
          )}
          {/* Flowing liquid aurora orbs */}
          <div
            className={cn(
              'absolute -top-24 -left-16 w-[78%] h-[58%] rounded-full blur-[64px] player-liquid-orb-a',
              !isPlaying && 'player-anim-paused'
            )}
            style={{
              background: isDark
                ? 'radial-gradient(circle, color-mix(in srgb, var(--m3-primary) 54%, transparent) 0%, transparent 70%)'
                : 'radial-gradient(circle, color-mix(in srgb, var(--m3-primary) 34%, transparent) 0%, transparent 70%)',
            }}
          />
          <div
            className={cn(
              'absolute -bottom-20 -right-16 w-[82%] h-[60%] rounded-full blur-[72px] player-liquid-orb-b',
              !isPlaying && 'player-anim-paused'
            )}
            style={{
              background: isDark
                ? 'radial-gradient(circle, color-mix(in srgb, var(--m3-primary-container) 62%, #4338CA 20%) 0%, transparent 72%)'
                : 'radial-gradient(circle, color-mix(in srgb, var(--m3-primary-container) 54%, #6366F1 14%) 0%, transparent 72%)',
            }}
          />
          {/* Legibility scrim */}
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, rgba(6,8,12,0.34) 0%, rgba(8,10,14,0.58) 65%, rgba(6,8,12,0.82) 100%)'
                : 'linear-gradient(180deg, rgba(250,251,255,0.46) 0%, rgba(247,248,252,0.72) 68%, rgba(247,248,252,0.92) 100%)',
            }}
          />
        </>
      )}
    </div>
  );
}
