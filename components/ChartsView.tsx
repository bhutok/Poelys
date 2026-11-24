'use client';

import React, { useEffect, useState } from 'react';
import {
  Disc3,
  Flame,
  Play,
  Shuffle,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { useMusic } from './MusicProvider';
import { TrackListSkeleton } from './Skeletons';
import { TrackContextMenu } from './TrackContextMenu';
import { formatDuration } from '@/lib/metrolist/lyrics';
import { SEED_TRACKS } from '@/lib/metrolist/seed';
import type { AlbumSummary, HomeShelfItem, Track } from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

const CHART_QUERIES = [
  { id: 'top-songs', label: 'Top Songs', query: 'top music charts hits 2026', type: 'songs' },
  { id: 'top-id', label: 'Indonesia Hits', query: 'lagu pop indonesia hits terbaru', type: 'songs' },
  { id: 'trending-videos', label: 'Music Videos', query: 'official music video trending', type: 'videos' },
  { id: 'featured-playlists', label: 'Top Playlists', query: 'top hits playlist', type: 'playlists' },
];

interface MoodTile {
  id: string;
  label: string;
  query: string;
  accent: string;
  bgTint: string;
}

const MOOD_GENRE_TILES: MoodTile[] = [
  { id: 'pop', label: 'Pop Anthems', query: 'global pop hits 2026', accent: '#EC4899', bgTint: 'rgba(236, 72, 153, 0.14)' },
  { id: 'chill', label: 'Chill & Lo-Fi', query: 'chill lofi relaxing beats', accent: '#14B8A6', bgTint: 'rgba(20, 184, 166, 0.14)' },
  { id: 'indo', label: 'Indo Viral', query: 'lagu indonesia viral terbaru', accent: '#F59E0B', bgTint: 'rgba(245, 158, 11, 0.14)' },
  { id: 'workout', label: 'Workout Energy', query: 'workout hype gym edm hip hop', accent: '#EF4444', bgTint: 'rgba(239, 68, 68, 0.14)' },
  { id: 'focus', label: 'Deep Focus', query: 'ambient instrumental study focus', accent: '#38BDF8', bgTint: 'rgba(56, 189, 248, 0.14)' },
  { id: 'rnb', label: 'R&B Soul', query: 'smooth r&b soul hits', accent: '#A855F7', bgTint: 'rgba(168, 85, 247, 0.14)' },
  { id: 'electronic', label: 'Electronic', query: 'electronic synthwave house hits', accent: '#6366F1', bgTint: 'rgba(99, 102, 241, 0.14)' },
  { id: 'acoustic', label: 'Acoustic', query: 'indie acoustic folk unplugged', accent: '#10B981', bgTint: 'rgba(16, 185, 129, 0.14)' },
  { id: 'jpop', label: 'J-Pop & Anime', query: 'jpop anime trending hits', accent: '#FB7185', bgTint: 'rgba(251, 113, 133, 0.14)' },
];

function pickChartStartIndex(length: number): number {
  if (length <= 1) return 0;
  return Math.floor(Math.random() * length);
}

export function ChartsView() {
  const { settings, playTrack, currentTrack, openDetail } = useMusic();
  const [activeChart, setActiveChart] = useState(CHART_QUERIES[0].id);
  const [activeMood, setActiveMood] = useState<MoodTile | null>(null);
  const [items, setItems] = useState<HomeShelfItem[]>([]);
  const [newReleases, setNewReleases] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const selected = CHART_QUERIES.find((c) => c.id === activeChart) || CHART_QUERIES[0];
    const searchQuery = activeMood ? activeMood.query : selected.query;
    const searchType = activeMood ? 'songs' : selected.type;
    let cancelled = false;

    const loadCharts = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}&gl=${settings.region}`
        );
        const data = (await res.json()) as { results?: HomeShelfItem[] };
        if (!cancelled) {
          setItems(
            data.results && data.results.length > 0
              ? data.results
              : SEED_TRACKS.map((t) => ({ ...t, kind: 'TRACK' as const }))
          );
        }
      } catch {
        if (!cancelled) {
          setItems(SEED_TRACKS.map((t) => ({ ...t, kind: 'TRACK' as const })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCharts();

    return () => {
      cancelled = true;
    };
  }, [activeChart, activeMood, settings.region]);

  // Fetch New Releases showcase albums for Explore
  useEffect(() => {
    let cancelled = false;
    const loadReleases = async () => {
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent('new album release 2026')}&type=albums&gl=${settings.region}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { results?: HomeShelfItem[] };
        const albums = (data.results || []).filter(
          (i): i is AlbumSummary & { kind: 'ALBUM' } => i.kind === 'ALBUM'
        );
        if (!cancelled && albums.length > 0) {
          setNewReleases(albums.slice(0, 10));
        }
      } catch {
        // ignore optional carousel failure
      }
    };
    void loadReleases();
    return () => {
      cancelled = true;
    };
  }, [settings.region]);

  const tracks = items.filter(
    (i): i is Track & { kind: 'TRACK' } => i.kind === 'TRACK'
  );
  const podiumTracks = tracks.slice(0, 3);
  const restTracks = tracks.slice(3);

  const handleShuffleChart = () => {
    if (tracks.length === 0) return;
    const idx = pickChartStartIndex(tracks.length);
    playTrack(tracks[idx], tracks);
  };

  return (
    <div
      data-testid="explore-charts-view"
      className="space-y-7 pb-36 bg-[var(--m3-bg)] relative isolate"
    >
      {/* Expressive Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            Explore
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Regional charts, mood spotlights, and fresh album releases · {settings.region}
          </p>
        </div>

        {tracks.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => playTrack(tracks[0], tracks)}
              className="h-11 px-5 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-md hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Chart</span>
            </button>
            <button
              type="button"
              onClick={handleShuffleChart}
              aria-label="Shuffle chart"
              className="h-11 px-4 rounded-full metro-surface text-xs sm:text-sm font-semibold text-slate-800 dark:text-white hover:bg-[var(--m3-surface-high)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Moods & Genres Expressive Tile Strip */}
      <section className="space-y-2.5 bg-[var(--m3-bg)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--m3-primary)]" />
            <span>Moods & Genres</span>
          </h2>
          {activeMood && (
            <button
              type="button"
              onClick={() => setActiveMood(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--m3-primary)] hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear mood</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {MOOD_GENRE_TILES.map((tile) => {
            const selected = activeMood?.id === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                data-testid={`explore-mood-${tile.id}`}
                onClick={() => setActiveMood(selected ? null : tile)}
                style={{
                  backgroundColor: selected ? tile.accent : tile.bgTint,
                  borderColor: selected ? tile.accent : `${tile.accent}44`,
                  color: selected ? '#FFFFFF' : undefined,
                }}
                className={cn(
                  'h-11 px-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 active:scale-[0.98]',
                  !selected && 'text-slate-900 dark:text-white'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selected ? '#FFFFFF' : tile.accent }}
                />
                <span>{tile.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Chart Category Switcher */}
      <div
        role="tablist"
        aria-label="Chart sections"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-[var(--m3-bg)]"
      >
        {CHART_QUERIES.map((chart) => {
          const active = !activeMood && activeChart === chart.id;
          return (
            <button
              key={chart.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveMood(null);
                setActiveChart(chart.id);
              }}
              className={cn(
                'h-10 px-4 rounded-full text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0',
                active
                  ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] shadow-sm'
                  : 'metro-surface text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              )}
            >
              {chart.label}
            </button>
          );
        })}
      </div>

      {/* Main Chart Body: Top 3 Expressive Podium + #4+ Ranked List */}
      {loading ? (
        <TrackListSkeleton rows={10} />
      ) : tracks.length > 0 ? (
        <div className="space-y-6">
          {/* Top 3 Featured Podium Spotlight */}
          {podiumTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                  {activeMood ? `${activeMood.label} Top Picks` : 'Top 3 Podium'}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Updated live
                </span>
              </div>

              <div
                data-testid="charts-podium-grid"
                className="grid grid-cols-1 md:grid-cols-3 gap-3.5"
              >
                {podiumTracks.map((track, idx) => {
                  const isFirst = idx === 0;
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={`${track.videoId}-podium-${idx}`}
                      className={cn(
                        'relative overflow-hidden p-4 transition-all group flex flex-col justify-between gap-3.5',
                        isFirst
                          ? 'rounded-tl-[32px] rounded-tr-[16px] rounded-bl-[16px] rounded-br-[32px] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] shadow-lg'
                          : 'rounded-[24px] metro-surface hover:bg-[var(--m3-surface-high)]',
                        active && 'ring-2 ring-[var(--m3-primary)]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-xs font-bold font-mono-nums',
                            isFirst
                              ? 'text-[var(--m3-on-primary-container)]'
                              : 'text-[var(--m3-primary)]'
                          )}
                        >
                          {isFirst ? (
                            <Trophy className="w-4 h-4" />
                          ) : (
                            <Flame className="w-3.5 h-3.5" />
                          )}
                          <span>#{idx + 1} Trending</span>
                        </span>
                        <TrackContextMenu track={track} />
                      </div>

                      <button
                        type="button"
                        onClick={() => playTrack(track, tracks)}
                        className="flex items-center gap-3.5 text-left min-w-0 w-full"
                      >
                        <div className="relative w-18 h-18 sm:w-20 sm:h-20 shrink-0 rounded-2xl overflow-hidden shadow-md">
                          <ArtworkImage
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full"
                            rounded=""
                            sizeHint="sm"
                          />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-6 h-6 text-white fill-current" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold leading-snug line-clamp-2">
                            {track.title}
                          </p>
                          <p className="text-xs opacity-75 truncate mt-1">
                            {track.artist}
                            {track.duration !== null && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono-nums">
                                  {formatDuration(track.duration)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* #4+ Ranked List */}
          {restTracks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                Full Rankings
              </h2>
              <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
                {restTracks.map((track, idx) => {
                  const rank = idx + 4;
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={`${track.videoId}-${rank}`}
                      className={cn(
                        'flex items-center gap-3 px-3 sm:px-4 py-2.5 first:rounded-t-[28px] last:rounded-b-[28px] transition-colors',
                        active
                          ? 'bg-[var(--m3-primary-soft)]'
                          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                      )}
                    >
                      <span className="w-7 text-center text-xs font-mono-nums font-bold text-slate-400 shrink-0">
                        {rank}
                      </span>

                      <button
                        type="button"
                        onClick={() => playTrack(track, tracks)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <ArtworkImage
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-12"
                          rounded="rounded-xl"
                          sizeHint="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'text-sm font-semibold truncate',
                              active
                                ? 'text-[var(--m3-primary)]'
                                : 'text-slate-900 dark:text-white'
                            )}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {track.artist}
                            {track.duration !== null && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono-nums">
                                  {formatDuration(track.duration)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </button>

                      <TrackContextMenu track={track} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item, idx) => {
            if (item.kind !== 'PLAYLIST') return null;
            return (
              <button
                key={`${item.playlistId}-${idx}`}
                type="button"
                onClick={() =>
                  openDetail({
                    kind: 'playlist',
                    id: item.playlistId,
                    title: item.title,
                    thumbnail: item.thumbnail,
                  })
                }
                className="text-left group space-y-2.5 p-3 rounded-[24px] metro-surface hover:bg-[var(--m3-surface-high)] transition-colors"
              >
                <ArtworkImage
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full aspect-square"
                  rounded="rounded-2xl"
                />
                <div className="flex items-start gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--m3-primary)] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.artist}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New Releases Horizontal Showcase */}
      {newReleases.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-[var(--m3-primary)]" />
              <span>New Releases</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Albums & Singles
            </span>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
            {newReleases.map((alb) => (
              <button
                key={alb.albumId}
                type="button"
                onClick={() =>
                  openDetail({
                    kind: 'album',
                    id: alb.albumId,
                    title: alb.title,
                    thumbnail: alb.thumbnail,
                  })
                }
                className="w-40 sm:w-44 shrink-0 text-left p-2.5 rounded-[22px] metro-surface hover:bg-[var(--m3-surface-high)] transition-colors group space-y-2"
              >
                <ArtworkImage
                  src={alb.thumbnail}
                  alt={alb.title}
                  className="w-full aspect-square shadow-sm"
                  rounded="rounded-2xl"
                />
                <div className="px-0.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[var(--m3-primary)] transition-colors">
                    {alb.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {alb.artist}
                    {alb.year ? ` · ${alb.year}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
