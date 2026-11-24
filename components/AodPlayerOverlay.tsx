'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock,
  Lock,
  Palette,
  Pause,
  Play,
  Shapes,
  SkipBack,
  SkipForward,
  Unlock,
  X,
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { useMusic } from './MusicProvider';
import { findActiveLyricIndexWithOffset } from '@/lib/metrolist/lyricsEngine';
import type {
  AodArtworkShape,
  AodBackgroundStyle,
  AodClockStyle,
} from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

const CLOCK_CYCLE: AodClockStyle[] = ['BOLD', 'MINIMAL', 'STACKED'];
const SHAPE_CYCLE: AodArtworkShape[] = [
  'SQUIRCLE',
  'CIRCLE',
  'ARCH',
  'ROUNDED',
  'DIAMOND',
];
const BG_CYCLE: AodBackgroundStyle[] = [
  'AMBIENT_GLOW',
  'ADAPTIVE_ART',
  'PURE_BLACK',
];

interface AodPlayerOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function AodPlayerOverlay({ open, onClose }: AodPlayerOverlayProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlayPause,
    nextTrack,
    prevTrack,
    lyrics,
    settings,
    updateSettings,
  } = useMusic();

  const [now, setNow] = useState<Date>(() => new Date());
  const [touchLocked, setTouchLocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !touchLocked) {
        onClose();
      } else if (e.key === ' ' && !touchLocked) {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, touchLocked, onClose, togglePlayPause]);

  const activeLyricText = useMemo(() => {
    if (!lyrics?.synced || lyrics.lines.length === 0) return null;
    const idx = findActiveLyricIndexWithOffset(
      lyrics.lines,
      currentTime,
      settings.lyricsGlobalOffsetMs
    );
    if (idx < 0) return lyrics.lines[0]?.text ?? null;
    return lyrics.lines[idx]?.text ?? null;
  }, [lyrics, currentTime, settings.lyricsGlobalOffsetMs]);

  if (!currentTrack) return null;

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const clockStyle = settings.aodClockStyle ?? 'BOLD';
  const artworkShape = settings.aodArtworkShape ?? 'SQUIRCLE';
  const bgStyle = settings.aodBackgroundStyle ?? 'AMBIENT_GLOW';

  const cycleClockStyle = () => {
    const nextIdx = (CLOCK_CYCLE.indexOf(clockStyle) + 1) % CLOCK_CYCLE.length;
    updateSettings({ aodClockStyle: CLOCK_CYCLE[nextIdx] });
  };

  const cycleArtworkShape = () => {
    const nextIdx = (SHAPE_CYCLE.indexOf(artworkShape) + 1) % SHAPE_CYCLE.length;
    updateSettings({ aodArtworkShape: SHAPE_CYCLE[nextIdx] });
  };

  const cycleBgStyle = () => {
    const nextIdx = (BG_CYCLE.indexOf(bgStyle) + 1) % BG_CYCLE.length;
    updateSettings({ aodBackgroundStyle: BG_CYCLE[nextIdx] });
  };

  const shapeRadiusClass =
    artworkShape === 'CIRCLE'
      ? 'rounded-full'
      : artworkShape === 'ARCH'
        ? 'rounded-t-[999px] rounded-b-[24px]'
        : artworkShape === 'ROUNDED'
          ? 'rounded-2xl'
          : artworkShape === 'DIAMOND'
            ? 'rounded-[28px] rotate-45 scale-[0.82]'
            : 'rounded-[40px]';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="aod-player-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label="Ambient Always-On Display"
          data-testid="aod-overlay"
          data-clock-style={clockStyle}
          data-artwork-shape={artworkShape}
          data-bg-style={bgStyle}
          data-touch-locked={touchLocked ? 'true' : 'false'}
          className="fixed inset-0 z-[70] bg-black text-white flex flex-col justify-between px-6 py-6 sm:py-8 select-none overflow-hidden"
        >
          {/* Selectable OLED Backdrop: Pure Black / Ambient Glow / Adaptive Blurred Art */}
          {bgStyle === 'AMBIENT_GLOW' && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-500"
              style={{
                background:
                  'radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--m3-primary) 34%, transparent) 0%, transparent 58%)',
              }}
            />
          )}
          {bgStyle === 'ADAPTIVE_ART' && currentTrack.thumbnail && (
            <>
              <img
                src={currentTrack.thumbnail}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/85"
              />
            </>
          )}

          {/* Top Bar: Touch Lock + Style Cyclers + Close */}
          <div className="relative z-10 flex items-center justify-between gap-2 max-w-xl w-full mx-auto">
            <button
              type="button"
              onClick={() => setTouchLocked((prev) => !prev)}
              aria-label={touchLocked ? 'Unlock touch controls' : 'Lock touch controls'}
              aria-pressed={touchLocked}
              data-testid="aod-touch-lock"
              className={cn(
                'min-h-[44px] px-3.5 rounded-full flex items-center gap-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                touchLocked
                  ? 'bg-white/15 text-white border border-white/25'
                  : 'text-white/55 hover:text-white hover:bg-white/10'
              )}
            >
              {touchLocked ? (
                <>
                  <Lock className="w-4 h-4 text-[var(--m3-primary)]" />
                  <span>Locked — Tap to Unlock</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Touch Lock</span>
                </>
              )}
            </button>

            {!touchLocked && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cycleClockStyle}
                  aria-label="Switch ambient clock style"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline capitalize">
                    {clockStyle.toLowerCase()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={cycleArtworkShape}
                  aria-label="Switch ambient artwork shape"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <Shapes className="w-4 h-4" />
                  <span className="hidden sm:inline capitalize">
                    {artworkShape.toLowerCase()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={cycleBgStyle}
                  aria-label="Switch ambient backdrop style"
                  className="min-h-[44px] min-w-[44px] px-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <Palette className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {bgStyle === 'PURE_BLACK'
                      ? 'OLED'
                      : bgStyle === 'ADAPTIVE_ART'
                        ? 'Art'
                        : 'Glow'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Exit Ambient Mode"
                  className="min-h-[44px] min-w-[44px] rounded-full text-white/65 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Center Stage: Digital Clock + Shaped Artwork + Track Info + Live Lyric Line */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 sm:gap-7 max-w-md w-full mx-auto text-center">
            {/* Digital Clock Widget */}
            <div className="space-y-1">
              {clockStyle === 'STACKED' ? (
                <div className="flex flex-col items-center leading-[0.88] font-bold tracking-tighter font-mono-nums">
                  <span className="text-[64px] sm:text-[76px] text-white/95">
                    {hours}
                  </span>
                  <span className="text-[64px] sm:text-[76px] text-[var(--m3-primary)]">
                    {minutes}
                  </span>
                </div>
              ) : clockStyle === 'MINIMAL' ? (
                <p className="text-[52px] sm:text-[64px] font-light tracking-[0.06em] font-mono-nums text-white/90 leading-none">
                  {hours}:{minutes}
                </p>
              ) : (
                <p className="text-[64px] sm:text-[80px] font-extrabold tracking-tight font-mono-nums text-white leading-none">
                  {hours}
                  <span className="text-[var(--m3-primary)] mx-0.5">:</span>
                  {minutes}
                </p>
              )}
              <p className="text-xs sm:text-sm font-medium text-white/45 tracking-wide">
                {dateLabel}
              </p>
            </div>

            {/* Shaped Artwork Showcase */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
              <div
                className={cn(
                  'w-full h-full overflow-hidden border border-white/15 shadow-2xl transition-all duration-500',
                  shapeRadiusClass,
                  artworkShape === 'CIRCLE' && isPlaying && 'animate-[spin_26s_linear_infinite]'
                )}
              >
                <div
                  className={cn(
                    'w-full h-full',
                    artworkShape === 'DIAMOND' && '-rotate-45 scale-[1.35]'
                  )}
                >
                  <ArtworkImage
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full"
                    rounded=""
                    sizeHint="lg"
                  />
                </div>
              </div>
            </div>

            {/* Track Title, Artist & Thin Progress Line */}
            <div className="w-full max-w-xs space-y-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-white/55 truncate">{currentTrack.artist}</p>

              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-[var(--m3-primary)] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Live Single-Line Synced Lyrics Ticker */}
              <div className="min-h-[36px] flex items-center justify-center pt-1">
                <AnimatePresence mode="wait">
                  {activeLyricText && (
                    <motion.p
                      key={activeLyricText}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="text-xs sm:text-sm font-medium text-white/75 line-clamp-2"
                    >
                      {activeLyricText}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Bottom Low-Burn OLED Transport Controls (Hidden when Touch Locked) */}
          <div className="relative z-10 h-16 flex items-center justify-center max-w-xs w-full mx-auto">
            {touchLocked ? (
              <p className="text-xs text-white/35 text-center">
                Controls locked to prevent accidental touches
              </p>
            ) : (
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={prevTrack}
                  aria-label="Ambient previous track"
                  className="min-h-[48px] min-w-[48px] rounded-full text-white/75 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Ambient pause' : 'Ambient play'}
                  className="w-14 h-14 rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => nextTrack(true)}
                  aria-label="Ambient next track"
                  className="min-h-[48px] min-w-[48px] rounded-full text-white/75 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
