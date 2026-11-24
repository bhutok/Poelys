'use client';

import React from 'react';
import {
  ChevronUp,
  Heart,
  Loader2,
  Pause,
  PictureInPicture2,
  Play,
  SkipForward,
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { LiquidGlassBackdropLayer } from './LiquidGlassSurface';
import { useMusic } from './MusicProvider';
import { formatDuration } from '@/lib/metrolist/lyrics';

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    togglePlayPause,
    nextTrack,
    isLiked,
    toggleLike,
    setIsNowPlayingOpen,
    popupMode,
    toggleBackgroundPopup,
    settings,
  } = useMusic();

  if (!currentTrack) return null;

  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const liked = isLiked(currentTrack.videoId);
  const isLiquidGlass = settings.dockStyle === 'liquid-glass';

  return (
    <div className="hidden lg:block fixed bottom-4 left-[284px] right-6 z-40 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <div
          className={`relative overflow-hidden px-3.5 py-2 flex items-center gap-3 ${
            isLiquidGlass
              ? 'rounded-full'
              : 'rounded-[22px] metro-surface shadow-xl'
          }`}
        >
          {isLiquidGlass && (
            <LiquidGlassBackdropLayer
              preset="pill"
              fallbackWidth={680}
              fallbackHeight={60}
            />
          )}

          {/* Thin specular progress hairline along bottom edge */}
          <div className="absolute bottom-0 left-6 right-6 z-10 h-[2px] bg-black/5 dark:bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--m3-primary)] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Track artwork & info -> opens full Now Playing sheet */}
          <button
            type="button"
            onClick={() => setIsNowPlayingOpen(true)}
            aria-label={`Open Now Playing for ${currentTrack.title}`}
            className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left group"
          >
            <ArtworkImage
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className="w-10 h-10 sm:w-11 sm:h-11 shadow-sm shrink-0"
              rounded="rounded-xl"
              sizeHint="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-[var(--m3-primary)] transition-colors">
                {currentTrack.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentTrack.artist}
                <span aria-hidden="true"> · </span>
                <span className="font-mono-nums">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </p>
            </div>
          </button>

          {/* Compact Controls */}
          <div className="relative z-10 flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => toggleLike(currentTrack)}
              aria-label={liked ? 'Unlike current track' : 'Like current track'}
              className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <Heart
                className={`w-4 h-4 ${
                  liked ? 'fill-[var(--m3-primary)] text-[var(--m3-primary)]' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] hover:scale-[1.04] active:scale-[0.96] transition-transform"
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => nextTrack(true)}
              aria-label="Next track"
              className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={toggleBackgroundPopup}
              aria-label={
                popupMode === 'off'
                  ? 'Pop out Dynamic Island'
                  : 'Close Dynamic Island popup'
              }
              title="Dynamic Island Background Popup"
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full transition-colors ${
                popupMode !== 'off'
                  ? 'text-[var(--m3-primary)] bg-[var(--m3-primary-soft)]'
                  : 'text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsNowPlayingOpen(true)}
              aria-label="Expand Now Playing"
              className="hidden md:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
