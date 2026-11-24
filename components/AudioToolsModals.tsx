'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Clock,
  Disc3,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { useMusic } from './MusicProvider';
import {
  clampEqBand,
  EQ_BAND_LABELS,
  EQUALIZER_PRESETS,
} from '@/lib/metrolist/statsEngine';
import type { EqualizerPreset } from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

const PRESET_KEYS = Object.keys(EQUALIZER_PRESETS) as Array<
  Exclude<EqualizerPreset, 'CUSTOM'>
>;

export function EqualizerSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, updateSettings, showToast } = useMusic();

  const bands =
    Array.isArray(settings.equalizerBands) && settings.equalizerBands.length === 5
      ? settings.equalizerBands
      : [0, 0, 0, 0, 0];
  const activePreset = settings.equalizerPreset ?? 'FLAT';
  const bassBoost = Boolean(settings.bassBoostEnabled);

  const selectPreset = (presetKey: Exclude<EqualizerPreset, 'CUSTOM'>) => {
    const preset = EQUALIZER_PRESETS[presetKey];
    updateSettings({
      equalizerPreset: presetKey,
      equalizerBands: [...preset.bands],
      bassBoostEnabled: presetKey === 'BASS_BOOST' ? true : bassBoost,
    });
    showToast(`Equalizer: ${preset.label}`);
  };

  const handleBandChange = (index: number, rawValue: number) => {
    const next = [...bands];
    next[index] = clampEqBand(rawValue);
    updateSettings({
      equalizerPreset: 'CUSTOM',
      equalizerBands: next,
    });
  };

  const handleReset = () => {
    updateSettings({
      equalizerPreset: 'FLAT',
      equalizerBands: [0, 0, 0, 0, 0],
      bassBoostEnabled: false,
    });
    showToast('Equalizer reset to Flat');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="equalizer-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Audio Equalizer"
          data-testid="equalizer-sheet"
          className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0.9 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] rounded-t-[28px] sm:rounded-[28px] bg-[var(--m3-surface)] border border-[var(--m3-border)] overflow-hidden flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--m3-primary) 16%, transparent)',
                    color: 'var(--m3-primary)',
                  }}
                >
                  <Sliders className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                    Audio Equalizer
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activePreset === 'CUSTOM'
                      ? 'Custom 5-band contour'
                      : EQUALIZER_PRESETS[activePreset].description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset equalizer to flat"
                  className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Equalizer"
                  className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {/* Preset Selector Grid */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Sound Profile Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_KEYS.map((key) => {
                    const preset = EQUALIZER_PRESETS[key];
                    const active = activePreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid={`eq-preset-${key.toLowerCase()}`}
                        onClick={() => selectPreset(key)}
                        className={cn(
                          'h-9 px-3.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap',
                          active
                            ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm'
                            : 'bg-black/[0.05] dark:bg-white/[0.07] text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/12'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5-Band Frequency Contour Matrix */}
              <div className="rounded-3xl bg-black/[0.03] dark:bg-white/[0.04] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between text-[11px] font-mono-nums text-slate-500 dark:text-slate-400">
                  <span>+12 dB</span>
                  <span>0 dB Reference</span>
                  <span>-12 dB</span>
                </div>

                <div className="space-y-3.5">
                  {EQ_BAND_LABELS.map((freq, idx) => {
                    const val = bands[idx] ?? 0;
                    const normalizedPct = ((val + 12) / 24) * 100;
                    return (
                      <div key={freq} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono-nums font-semibold text-slate-700 dark:text-slate-200 w-14">
                            {freq}
                          </span>
                          <div className="flex-1 mx-3 relative h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                            <div
                              className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/20 dark:bg-white/25"
                              aria-hidden="true"
                            />
                            <div
                              className="h-full rounded-full bg-[var(--m3-primary)] transition-all duration-150"
                              style={{ width: `${normalizedPct}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'font-mono-nums font-bold w-12 text-right',
                              val !== 0
                                ? 'text-[var(--m3-primary)]'
                                : 'text-slate-400'
                            )}
                          >
                            {val > 0 ? `+${val}` : val} dB
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={1}
                          value={val}
                          onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                          aria-label={`${freq} band gain`}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-black/10 dark:bg-white/15 accent-[var(--m3-primary)]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Bass Boost Toggle */}
              <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Volume2 className="w-4 h-4 text-[var(--m3-primary)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Sub-Bass Enhancement
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Adds warm low-end weight for headphones & speakers
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bassBoost}
                  aria-label="Toggle Sub-Bass Enhancement"
                  onClick={() => updateSettings({ bassBoostEnabled: !bassBoost })}
                  className={cn(
                    'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
                    bassBoost
                      ? 'bg-[var(--m3-primary)] border-[var(--m3-primary)]'
                      : 'bg-black/10 dark:bg-white/10 border-black/15 dark:border-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block rounded-full transition-all shadow-sm',
                      bassBoost
                        ? 'h-5 w-5 translate-x-[23px] bg-[var(--m3-on-primary)]'
                        : 'h-4 w-4 translate-x-[5px] bg-slate-500 dark:bg-slate-300'
                    )}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SLEEP_QUICK_MINUTES = [10, 15, 30, 45, 60, 90];

export function SleepTimerSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    sleepTimerMinutes,
    setSleepTimer,
    sleepTimerEndOfTrack,
    setSleepTimerEndOfTrack,
  } = useMusic();

  const [customMinutes, setCustomMinutes] = useState<number>(
    sleepTimerMinutes ?? 25
  );

  const hasActiveTimer = sleepTimerMinutes !== null || sleepTimerEndOfTrack;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sleep-timer-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Sleep Timer"
          data-testid="sleep-timer-sheet"
          className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0.9 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-[var(--m3-surface)] border border-[var(--m3-border)] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/[0.08]">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor:
                      'color-mix(in srgb, var(--m3-primary) 16%, transparent)',
                    color: 'var(--m3-primary)',
                  }}
                >
                  <Clock className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                    Sleep Timer
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sleepTimerEndOfTrack
                      ? 'Pauses after current track finishes'
                      : sleepTimerMinutes
                        ? `Active · ${sleepTimerMinutes} min countdown`
                        : 'Stop playback automatically'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Sleep Timer"
                className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* End of Current Track Featured Action */}
              <button
                type="button"
                data-testid="sleep-end-of-track-btn"
                onClick={() => {
                  setSleepTimerEndOfTrack(!sleepTimerEndOfTrack);
                  if (!sleepTimerEndOfTrack) onClose();
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-all border',
                  sleepTimerEndOfTrack
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] border-[var(--m3-primary)]'
                    : 'bg-black/[0.03] dark:bg-white/[0.04] border-transparent hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Disc3 className="w-5 h-5 shrink-0 text-[var(--m3-primary)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">End of Current Track</p>
                    <p className="text-xs opacity-75">
                      Let this song finish, then pause cleanly
                    </p>
                  </div>
                </div>
                {sleepTimerEndOfTrack && <Check className="w-5 h-5 shrink-0" />}
              </button>

              {/* Quick Duration Grid */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Quick Countdown
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SLEEP_QUICK_MINUTES.map((mins) => {
                    const active = !sleepTimerEndOfTrack && sleepTimerMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setCustomMinutes(mins);
                          setSleepTimer(mins);
                          onClose();
                        }}
                        className={cn(
                          'h-11 rounded-2xl text-xs font-bold font-mono-nums transition-all',
                          active
                            ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm'
                            : 'bg-black/[0.05] dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 hover:bg-black/10 dark:hover:bg-white/12'
                        )}
                      >
                        {mins} min
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Minute Slider (5 - 120 min) */}
              <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--m3-primary)]" />
                    Custom Duration
                  </span>
                  <span className="text-base font-bold font-mono-nums text-[var(--m3-primary)]">
                    {customMinutes} min
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  aria-label="Custom sleep timer minutes"
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-black/10 dark:bg-white/15 accent-[var(--m3-primary)]"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSleepTimer(customMinutes);
                      onClose();
                    }}
                    className="flex-1 h-11 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-bold shadow-md hover:brightness-110 transition-all"
                  >
                    Start {customMinutes} min Timer
                  </button>
                  {hasActiveTimer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSleepTimer(null);
                        setSleepTimerEndOfTrack(false);
                        onClose();
                      }}
                      className="h-11 px-4 rounded-full bg-rose-500/15 text-rose-500 text-xs font-bold hover:bg-rose-500/25 transition-colors whitespace-nowrap"
                    >
                      Turn Off
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
