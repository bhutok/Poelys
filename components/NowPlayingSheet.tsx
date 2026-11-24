'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Disc3,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  MessageSquareQuote,
  MoonStar,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Search,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Trash2,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AodPlayerOverlay } from './AodPlayerOverlay';
import { ArtworkImage } from './ArtworkImage';
import { EqualizerSheet, SleepTimerSheet } from './AudioToolsModals';
import { LyricsShareModal } from './LyricsShareModal';
import { useMusic } from './MusicProvider';
import { PlayerBackground } from './PlayerBackground';
import { PlayerSlider } from './PlayerSlider';
import { SyncedLyricsView } from './SyncedLyricsView';
import { formatDuration } from '@/lib/metrolist/lyrics';
import { cn } from '@/lib/utils';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function NowPlayingSheet() {
  const {
    isNowPlayingOpen,
    setIsNowPlayingOpen,
    nowPlayingTab,
    setNowPlayingTab,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    queueState,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    isLiked,
    toggleLike,
    openPlaylistPicker,
    startRadio,
    lyrics,
    lyricsLoading,
    jumpToQueueIndex,
    removeQueueIndex,
    moveQueueItem,
    sleepTimerMinutes,
    sleepTimerEndOfTrack,
    settings,
    updateSettings,
    showVideoStage,
    setShowVideoStage,
    popupMode,
    toggleBackgroundPopup,
  } = useMusic();

  const [aodOpen, setAodOpen] = useState(false);
  const [shareLyricsOpen, setShareLyricsOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState('');
  const [pressedControl, setPressedControl] = useState<'prev' | 'play' | 'next' | null>(
    null
  );

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.videoId);
  const remainingSec = Math.max(0, duration - currentTime);
  const seekStep = settings.seekDurationSeconds || 10;
  const artRadiusPx = settings.thumbnailCornerRadius ?? 24;
  const useExpressiveControls = settings.playerControlsStyle !== 'CLASSIC';

  return (
    <AnimatePresence>
      {isNowPlayingOpen && (
        <motion.div
          key="now-playing-sheet"
          initial={{ y: '100%', opacity: 0.7 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.7 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing"
          className="fixed inset-0 z-50 bg-[var(--m3-bg)] flex flex-col overflow-hidden"
        >
          {/* Multi-Mode Player Background (Blurred Artwork, Solid, Gradient, Animated Gradient, Liquid) */}
          <PlayerBackground
            style={settings.playerBackgroundStyle}
            thumbnail={currentTrack.thumbnail}
            isPlaying={isPlaying}
            theme={settings.theme}
          />

          {/* Sheet Top Bar (Zero horizontal clipping on narrow 320px-360px phones) */}
          <div className="relative z-10 shrink-0 px-3 sm:px-8 pt-3 sm:pt-4 pb-1.5 sm:pb-2 space-y-2 sm:space-y-0">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsNowPlayingOpen(false)}
                aria-label="Close Now Playing"
                className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-full liquid-glass text-slate-800 dark:text-white hover:scale-105 transition-transform"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              {/* Mobile-only compact status label centered cleanly between left & right icons */}
              <span className="sm:hidden text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400 truncate min-w-0 text-center">
                {nowPlayingTab === 'player'
                  ? 'Now Playing'
                  : nowPlayingTab === 'lyrics'
                  ? 'Synced Lyrics'
                  : 'Up Next'}
              </span>

              {/* Desktop / Tablet Segmented View Switch: Playing | Lyrics | Queue */}
              <div
                role="tablist"
                aria-label="Now Playing sections"
                className="hidden sm:flex items-center gap-1 p-1 rounded-2xl liquid-glass"
              >
                {(
                  [
                    { id: 'player', label: 'Playing', icon: Disc3 },
                    { id: 'lyrics', label: 'Lyrics', icon: MessageSquareQuote },
                    { id: 'queue', label: 'Queue', icon: ListMusic },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = nowPlayingTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setNowPlayingTab(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                        active
                          ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAodOpen(true)}
                  aria-label="Open Ambient Always-On Display"
                  title="Ambient Always-On Display"
                  data-testid="open-aod-btn"
                  className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-full liquid-glass text-slate-700 dark:text-slate-200 hover:scale-105 transition-transform"
                >
                  <MoonStar className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleBackgroundPopup();
                    setIsNowPlayingOpen(false);
                  }}
                  aria-label="Pop out Dynamic Island"
                  title="Pop out Dynamic Island for background play"
                  className={cn(
                    'w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-full transition-colors',
                    popupMode !== 'off'
                      ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                      : 'liquid-glass text-slate-700 dark:text-slate-200'
                  )}
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowVideoStage(!showVideoStage)}
                  aria-label={showVideoStage ? 'Switch to artwork view' : 'Switch to video view'}
                  className={cn(
                    'w-10 h-10 sm:w-auto sm:min-h-[44px] sm:px-3.5 shrink-0 flex items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                    showVideoStage
                      ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] font-semibold'
                      : 'liquid-glass text-slate-700 dark:text-slate-200'
                  )}
                >
                  <Video className="w-4 h-4" />
                  <span className="hidden sm:inline">Video</span>
                </button>
              </div>
            </div>

            {/* Mobile-only Second Row: Centered Playing | Lyrics | Queue switcher (zero side overflow) */}
            <div className="flex sm:hidden justify-center">
              <div
                role="tablist"
                aria-label="Now Playing sections mobile"
                className="inline-flex items-center gap-1 p-1 rounded-2xl liquid-glass max-w-full"
              >
                {(
                  [
                    { id: 'player', label: 'Playing', icon: Disc3 },
                    { id: 'lyrics', label: 'Lyrics', icon: MessageSquareQuote },
                    { id: 'queue', label: 'Queue', icon: ListMusic },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = nowPlayingTab === tab.id;
                  return (
                    <button
                      key={`m-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setNowPlayingTab(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                        active
                          ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] font-semibold'
                          : 'text-slate-600 dark:text-slate-300'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Sheet Content */}
          <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-10 py-3 sm:py-4 flex flex-col items-center justify-center">
            {nowPlayingTab === 'player' && (
              <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center my-auto min-w-0">
                {/* Left Column: Tactile Artwork with Customizable Corner Radius & Swipe-to-Skip Gesture */}
                <div className="flex flex-col items-center w-full min-w-0">
                  <motion.div
                    drag={settings.swipeToChangeTrack ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.28}
                    onDragEnd={(_, info) => {
                      if (!settings.swipeToChangeTrack) return;
                      if (info.offset.x < -70 || info.velocity.x < -420) {
                        nextTrack(true);
                      } else if (info.offset.x > 70 || info.velocity.x > 420) {
                        prevTrack();
                      }
                    }}
                    animate={{ scale: isPlaying ? 1 : 0.93 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    style={{ borderRadius: `${artRadiusPx}px` }}
                    data-testid="now-playing-artwork"
                    data-corner-radius={artRadiusPx}
                    className={cn(
                      'w-full max-w-[264px] sm:max-w-[360px] aspect-square overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-black/10 dark:ring-white/15',
                      settings.swipeToChangeTrack && 'cursor-grab active:cursor-grabbing touch-pan-y'
                    )}
                  >
                    <ArtworkImage
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full pointer-events-none"
                      rounded=""
                      sizeHint="lg"
                    />
                  </motion.div>
                </div>

                {/* Right Column: Track Meta, Animated Progress Slider & Spatial Controls */}
                <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-md mx-auto min-w-0">
                  <div className="flex items-start justify-between gap-2.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                        {currentTrack.title}
                      </h2>
                      <p className="text-base text-slate-600 dark:text-slate-300 mt-1 truncate">
                        {currentTrack.artist}
                        {currentTrack.album?.name && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {currentTrack.album.name}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleLike(currentTrack)}
                        aria-label={liked ? 'Unlike track' : 'Like track'}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full metro-surface hover:scale-105 transition-transform"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            liked
                              ? 'fill-[var(--m3-primary)] text-[var(--m3-primary)]'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => openPlaylistPicker(currentTrack)}
                        aria-label="Add current track to playlist"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full metro-surface text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
                      >
                        <ListPlus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Style Interactive Scrub Bar (Squiggly, Wavy, Slim, Default) */}
                  <div className="space-y-1">
                    <PlayerSlider
                      style={settings.sliderStyle}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onSeek={seekTo}
                    />
                    <div className="flex items-center justify-between text-xs font-mono-nums text-slate-500 dark:text-slate-400">
                      <span>{formatDuration(currentTime)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => seekTo(Math.max(0, currentTime - seekStep))}
                          aria-label={`Rewind ${seekStep} seconds`}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[11px] font-semibold"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{seekStep}s</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            seekTo(Math.min(Math.max(duration, currentTime + seekStep), currentTime + seekStep))
                          }
                          aria-label={`Forward ${seekStep} seconds`}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[11px] font-semibold"
                        >
                          <span>{seekStep}s</span>
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </div>
                      <span>-{formatDuration(remainingSec)}</span>
                    </div>
                  </div>

                  {/* Primary Transport Controls: Expressive Elastic Morphing vs Classic */}
                  {useExpressiveControls ? (
                    <div
                      data-testid="v9-expressive-controls"
                      className="space-y-2.5"
                    >
                      <div className="flex items-center gap-2 h-[64px]">
                        <motion.button
                          type="button"
                          onPointerDown={() => setPressedControl('prev')}
                          onPointerUp={() => setPressedControl(null)}
                          onPointerLeave={() => setPressedControl(null)}
                          onClick={prevTrack}
                          aria-label="Previous track"
                          animate={{
                            flexGrow:
                              pressedControl === 'prev'
                                ? 1.24
                                : pressedControl
                                  ? 0.8
                                  : 1,
                          }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          className="h-full basis-0 min-w-[60px] flex items-center justify-center rounded-[22px] metro-surface text-slate-800 dark:text-white hover:brightness-110 active:brightness-95 transition-colors"
                        >
                          <SkipBack className="w-6 h-6 fill-current" />
                        </motion.button>

                        <motion.button
                          type="button"
                          onPointerDown={() => setPressedControl('play')}
                          onPointerUp={() => setPressedControl(null)}
                          onPointerLeave={() => setPressedControl(null)}
                          onClick={togglePlayPause}
                          aria-label={isPlaying ? 'Pause' : 'Play'}
                          animate={{
                            flexGrow:
                              pressedControl === 'play'
                                ? 1.75
                                : pressedControl
                                  ? 1.25
                                  : 1.5,
                            borderRadius: isPlaying ? 999 : 22,
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                          className="h-full basis-0 min-w-[96px] flex items-center justify-center bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-xl hover:brightness-110"
                        >
                          {isBuffering ? (
                            <Loader2 className="w-7 h-7 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-7 h-7 fill-current" />
                          ) : (
                            <Play className="w-7 h-7 fill-current ml-0.5" />
                          )}
                        </motion.button>

                        <motion.button
                          type="button"
                          onPointerDown={() => setPressedControl('next')}
                          onPointerUp={() => setPressedControl(null)}
                          onPointerLeave={() => setPressedControl(null)}
                          onClick={() => nextTrack(true)}
                          aria-label="Next track"
                          animate={{
                            flexGrow:
                              pressedControl === 'next'
                                ? 1.24
                                : pressedControl
                                  ? 0.8
                                  : 1,
                          }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          className="h-full basis-0 min-w-[60px] flex items-center justify-center rounded-[22px] metro-surface text-slate-800 dark:text-white hover:brightness-110 active:brightness-95 transition-colors"
                        >
                          <SkipForward className="w-6 h-6 fill-current" />
                        </motion.button>
                      </div>

                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={toggleShuffle}
                          aria-label="Toggle shuffle"
                          aria-pressed={queueState.shuffle}
                          className={cn(
                            'h-10 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-colors',
                            queueState.shuffle
                              ? 'bg-[var(--m3-primary-soft)] text-[var(--m3-primary)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                          )}
                        >
                          <Shuffle className="w-4 h-4" />
                          <span>Shuffle</span>
                        </button>

                        <button
                          type="button"
                          onClick={cycleRepeat}
                          aria-label={`Repeat mode: ${queueState.repeat}`}
                          className={cn(
                            'h-10 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-colors',
                            queueState.repeat !== 'off'
                              ? 'bg-[var(--m3-primary-soft)] text-[var(--m3-primary)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                          )}
                        >
                          {queueState.repeat === 'one' ? (
                            <Repeat1 className="w-4 h-4" />
                          ) : (
                            <Repeat className="w-4 h-4" />
                          )}
                          <span>
                            {queueState.repeat === 'off'
                              ? 'Repeat'
                              : queueState.repeat === 'one'
                                ? 'Repeat One'
                                : 'Repeat All'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      data-testid="classic-controls"
                      className="flex items-center justify-between"
                    >
                      <button
                        type="button"
                        onClick={toggleShuffle}
                        aria-label="Toggle shuffle"
                        aria-pressed={queueState.shuffle}
                        className={cn(
                          'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors',
                          queueState.shuffle
                            ? 'text-[var(--m3-primary)] bg-[var(--m3-primary-soft)]'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                        )}
                      >
                        <Shuffle className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={prevTrack}
                        aria-label="Previous track"
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-slate-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <SkipBack className="w-6 h-6 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={togglePlayPause}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="w-16 h-16 flex items-center justify-center rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-xl hover:scale-105 active:scale-95 transition-transform"
                      >
                        {isBuffering ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="w-7 h-7 fill-current" />
                        ) : (
                          <Play className="w-7 h-7 fill-current ml-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => nextTrack(true)}
                        aria-label="Next track"
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-slate-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                        <SkipForward className="w-6 h-6 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={cycleRepeat}
                        aria-label={`Repeat mode: ${queueState.repeat}`}
                        className={cn(
                          'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors',
                          queueState.repeat !== 'off'
                            ? 'text-[var(--m3-primary)] bg-[var(--m3-primary-soft)]'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
                        )}
                      >
                        {queueState.repeat === 'one' ? (
                          <Repeat1 className="w-5 h-5" />
                        ) : (
                          <Repeat className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Volume Control */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="Volume"
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-black/10 dark:bg-white/15 accent-[var(--m3-primary)]"
                    />
                  </div>

                  {/* Utility Strip: Radio, Equalizer, Custom Sleep Timer, Playback Speed */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void startRadio(currentTrack)}
                        className="h-9 px-3 rounded-xl metro-surface text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-[var(--m3-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Radio className="w-3.5 h-3.5 text-[var(--m3-primary)]" />
                        <span>Radio</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEqOpen(true)}
                        data-testid="open-equalizer-btn"
                        aria-label="Open Audio Equalizer"
                        className={cn(
                          'h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
                          (settings.equalizerPreset && settings.equalizerPreset !== 'FLAT') ||
                            settings.bassBoostEnabled
                            ? 'bg-[var(--m3-primary-soft)] text-[var(--m3-primary)]'
                            : 'metro-surface text-slate-700 dark:text-slate-200 hover:text-[var(--m3-primary)]'
                        )}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>EQ</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSleepSheetOpen(true)}
                        data-testid="open-sleep-timer-btn"
                        aria-label="Configure Sleep Timer"
                        className={cn(
                          'h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
                          sleepTimerMinutes !== null || sleepTimerEndOfTrack
                            ? 'bg-[var(--m3-primary-soft)] text-[var(--m3-primary)]'
                            : 'metro-surface text-slate-700 dark:text-slate-200 hover:text-[var(--m3-primary)]'
                        )}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-mono-nums">
                          {sleepTimerEndOfTrack
                            ? 'End Track'
                            : sleepTimerMinutes !== null
                              ? `${sleepTimerMinutes}m`
                              : 'Sleep'}
                        </span>
                      </button>

                      <select
                        aria-label="Playback speed"
                        value={settings.playbackRate}
                        onChange={(e) =>
                          updateSettings({ playbackRate: Number(e.target.value) })
                        }
                        className="h-9 px-2.5 rounded-xl metro-surface text-xs font-mono-nums font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                      >
                        {SPEED_OPTIONS.map((rate) => (
                          <option
                            key={rate}
                            value={rate}
                            className="bg-white dark:bg-[#1A1B20]"
                          >
                            {rate}x
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {nowPlayingTab === 'lyrics' && (
              <div className="w-full max-w-2xl h-full flex flex-col py-2 min-h-0">
                <div className="mb-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {currentTrack.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                      {currentTrack.artist}
                      {lyrics?.source && lyrics.source !== 'none' && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>Synced via {lyrics.source.toUpperCase()}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShareLyricsOpen(true)}
                    data-testid="open-lyrics-share-btn"
                    className="h-10 px-3.5 rounded-full metro-surface text-xs font-semibold text-slate-800 dark:text-white hover:text-[var(--m3-primary)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[var(--m3-primary)]" />
                    <span>Share Card</span>
                  </button>
                </div>

                {lyricsLoading ? (
                  <div
                    aria-busy="true"
                    aria-label="Loading lyrics"
                    className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
                  >
                    {['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2', 'w-3/5', 'w-2/3'].map(
                      (widthClass, idx) => (
                        <div
                          key={`lyric-skel-${idx}`}
                          className={cn('h-5 rounded-lg skeleton-block', widthClass)}
                        />
                      )
                    )}
                  </div>
                ) : lyrics?.synced && lyrics.lines.length > 0 ? (
                  <SyncedLyricsView
                    lines={lyrics.lines}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    playbackRate={settings.playbackRate}
                    animationStyle={settings.lyricsAnimationStyle}
                    textPosition={settings.lyricsTextPosition}
                    fontSize={settings.lyricsFontSize}
                    lineSpacing={settings.lyricsLineSpacing}
                    progressiveBlur={settings.lyricsProgressiveBlur}
                    neutralColor={settings.lyricsNeutralColor}
                    clickToSeek={settings.lyricsClickToSeek}
                    autoScroll={settings.lyricsAutoScroll}
                    globalOffsetMs={settings.lyricsGlobalOffsetMs}
                    onSeek={seekTo}
                    onOffsetChange={(nextMs) =>
                      updateSettings({ lyricsGlobalOffsetMs: nextMs })
                    }
                    showOffsetBar={true}
                  />
                ) : lyrics?.plainText ? (
                  <div className="flex-1 overflow-y-auto py-4 px-4 rounded-3xl metro-surface">
                    <pre
                      className={cn(
                        'whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200',
                        settings.lyricsTextPosition === 'LEFT'
                          ? 'text-left'
                          : settings.lyricsTextPosition === 'RIGHT'
                            ? 'text-right'
                            : 'text-center'
                      )}
                      style={{
                        fontSize: `${Math.max(15, Math.round(settings.lyricsFontSize * 0.72))}px`,
                        lineHeight: settings.lyricsLineSpacing,
                      }}
                    >
                      {lyrics.plainText}
                    </pre>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-500 dark:text-slate-400">
                    <MessageSquareQuote className="w-8 h-8 opacity-50" />
                    <p className="text-sm">
                      No lyrics available for this track yet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {nowPlayingTab === 'queue' && (
              <div className="w-full max-w-2xl h-full flex flex-col py-2 min-h-0">
                <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Up Next
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {queueState.queue.length} tracks in queue
                      <span aria-hidden="true"> · </span>
                      <span>
                        {settings.autoContinueRadio
                          ? 'Auto-radio active'
                          : 'Manual queue'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startRadio(currentTrack)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl metro-surface text-xs font-medium text-slate-800 dark:text-white hover:text-[var(--m3-primary)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Radio className="w-3.5 h-3.5 text-[var(--m3-primary)]" />
                    <span>Refresh Radio</span>
                  </button>
                </div>

                {/* Queue Live Search Input */}
                <div className="relative mb-3 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={queueFilter}
                    onChange={(e) => setQueueFilter(e.target.value)}
                    placeholder="Filter tracks in queue..."
                    aria-label="Filter queue"
                    data-testid="queue-search-input"
                    className="w-full h-10 pl-10 pr-9 rounded-2xl metro-surface text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
                  />
                  {queueFilter && (
                    <button
                      type="button"
                      onClick={() => setQueueFilter('')}
                      aria-label="Clear queue filter"
                      className="w-8 h-8 rounded-full flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {queueState.queue
                    .map((item, idx) => ({ item, idx }))
                    .filter(({ item }) => {
                      const q = queueFilter.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        item.title.toLowerCase().includes(q) ||
                        item.artist.toLowerCase().includes(q)
                      );
                    })
                    .map(({ item, idx }) => {
                      const isCurrent = idx === queueState.currentIndex;
                      return (
                        <div
                          key={`${item.videoId}-${idx}`}
                          className={cn(
                            'flex items-center gap-3 p-2.5 rounded-2xl transition-colors',
                            isCurrent
                              ? 'bg-[var(--m3-primary-soft)] border border-[var(--m3-ring)]'
                              : 'metro-surface'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => jumpToQueueIndex(idx)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          >
                            <ArtworkImage
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-11 h-11"
                              rounded="rounded-xl"
                              sizeHint="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'text-sm font-semibold truncate',
                                  isCurrent
                                    ? 'text-[var(--m3-primary)]'
                                    : 'text-slate-900 dark:text-white'
                                )}
                              >
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.artist}
                                {item.duration !== null && (
                                  <>
                                    <span aria-hidden="true"> · </span>
                                    <span className="font-mono-nums">
                                      {formatDuration(item.duration)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveQueueItem(idx, idx - 1)}
                              aria-label={`Move ${item.title} up`}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === queueState.queue.length - 1}
                              onClick={() => moveQueueItem(idx, idx + 1)}
                              aria-label={`Move ${item.title} down`}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQueueIndex(idx)}
                              aria-label={`Remove ${item.title} from queue`}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-500 hover:text-[var(--m3-primary)]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <AodPlayerOverlay open={aodOpen} onClose={() => setAodOpen(false)} />
          <LyricsShareModal
            open={shareLyricsOpen}
            onClose={() => setShareLyricsOpen(false)}
          />
          <EqualizerSheet open={eqOpen} onClose={() => setEqOpen(false)} />
          <SleepTimerSheet
            open={sleepSheetOpen}
            onClose={() => setSleepSheetOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
