'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Edit3,
  Play,
  Radio,
  Search,
  Shuffle,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { useMusic } from './MusicProvider';
import { DetailViewSkeleton } from './Skeletons';
import { TrackContextMenu } from './TrackContextMenu';
import { formatDuration } from '@/lib/metrolist/lyrics';
import {
  computeTotalDurationSec,
  filterTracksByQuery,
  formatLongDuration,
} from '@/lib/metrolist/statsEngine';
import type { AlbumSummary, PlaylistSummary, Track } from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

interface RemoteDetailData {
  kind: 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  tracks: Track[];
  albums?: AlbumSummary[];
  featuredOn?: PlaylistSummary[];
}

export function DetailView() {
  const {
    detailTarget,
    openDetail,
    playlists,
    renamePlaylist,
    updatePlaylistTags,
    removeTrackFromPlaylist,
    playTrack,
    startRadio,
    currentTrack,
    settings,
    isSavedInCollection,
    toggleSaveCollection,
  } = useMusic();

  const [remote, setRemote] = useState<RemoteDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (!detailTarget || detailTarget.kind === 'user-playlist') {
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/music/detail?kind=${detailTarget.kind}&id=${encodeURIComponent(
            detailTarget.id
          )}&gl=${settings.region}`
        );
        if (!res.ok) throw new Error('Request failed');
        const data = (await res.json()) as RemoteDetailData;
        if (!cancelled) setRemote(data);
      } catch {
        if (!cancelled) setError('Could not load details from YouTube Music.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [detailTarget, settings.region]);

  const userPlaylist = useMemo(() => {
    if (!detailTarget || detailTarget.kind !== 'user-playlist') return null;
    return playlists.find((p) => p.id === detailTarget.id) ?? null;
  }, [detailTarget, playlists]);

  const activeTracks = useMemo(() => {
    if (detailTarget?.kind === 'user-playlist') {
      return userPlaylist?.tracks ?? [];
    }
    return remote?.tracks ?? [];
  }, [detailTarget?.kind, userPlaylist, remote]);

  const filteredTracks = useMemo(
    () => filterTracksByQuery(activeTracks, trackFilter),
    [activeTracks, trackFilter]
  );

  const totalDurationLabel = useMemo(
    () => formatLongDuration(computeTotalDurationSec(activeTracks)),
    [activeTracks]
  );

  if (!detailTarget) return null;

  // User Playlist View (Immersive Adaptive Hero)
  if (detailTarget.kind === 'user-playlist') {
    if (!userPlaylist) {
      return (
        <div className="space-y-4 pb-36">
          <button
            type="button"
            onClick={() => openDetail(null)}
            className="h-10 px-4 rounded-full metro-surface inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="rounded-[28px] metro-surface p-8 text-center text-sm text-slate-500">
            Playlist not found.
          </div>
        </div>
      );
    }

    const cover = userPlaylist.coverUrl || userPlaylist.tracks[0]?.thumbnail || '';
    const tags = userPlaylist.tags || [];

    return (
      <div data-testid="detail-view" className="space-y-6 pb-36">
        {/* Immersive Adaptive Artwork Hero Banner */}
        <section className="relative overflow-hidden rounded-[32px] metro-surface p-5 sm:p-7">
          {cover && (
            <>
              <img
                src={cover}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-25 dark:opacity-30"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--m3-surface)]/55 via-[var(--m3-surface)]/80 to-[var(--m3-surface)]" />
            </>
          )}

          <div className="relative z-10 space-y-5">
            <button
              type="button"
              onClick={() => openDetail(null)}
              className="h-10 px-4 rounded-full bg-black/[0.06] dark:bg-white/[0.1] backdrop-blur-md inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:brightness-110 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-7">
              <ArtworkImage
                src={cover}
                alt={userPlaylist.name}
                className="w-40 h-40 sm:w-52 sm:h-52 shadow-2xl shrink-0"
                rounded="rounded-[26px]"
                sizeHint="lg"
              />

              <div className="space-y-3 flex-1 min-w-0">
                {editingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      renamePlaylist(userPlaylist.id, draftName);
                      setEditingName(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      aria-label="Edit playlist name"
                      className="h-11 px-4 rounded-2xl metro-surface text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      aria-label="Save playlist name"
                      className="h-11 w-11 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] flex items-center justify-center"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white truncate">
                      {userPlaylist.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(userPlaylist.name);
                        setEditingName(true);
                      }}
                      aria-label="Rename playlist"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {userPlaylist.description || 'Custom Playlist'}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono-nums">{userPlaylist.tracks.length} tracks</span>
                  {userPlaylist.tracks.length > 0 && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-nums">{totalDurationLabel}</span>
                    </>
                  )}
                </p>

                {/* Inline Tags Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        updatePlaylistTags(
                          userPlaylist.id,
                          tags.filter((existing) => existing !== t)
                        )
                      }
                      aria-label={`Remove tag ${t}`}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.09] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-500/15 hover:text-rose-500 transition-colors"
                    >
                      <span>#{t}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                  {addingTag ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (tagDraft.trim()) {
                          updatePlaylistTags(userPlaylist.id, [...tags, tagDraft.trim()]);
                        }
                        setTagDraft('');
                        setAddingTag(false);
                      }}
                      className="inline-flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="Tag..."
                        aria-label="Add tag to playlist"
                        className="h-7 w-28 px-2.5 rounded-full bg-black/5 dark:bg-white/10 text-xs focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="h-7 px-2.5 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingTag(true)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold text-[var(--m3-primary)] hover:bg-[var(--m3-primary-soft)] transition-colors"
                    >
                      <Tag className="w-3 h-3" />
                      <span>Add tag</span>
                    </button>
                  )}
                </div>

                {/* Expressive Action Bar */}
                {userPlaylist.tracks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        playTrack(userPlaylist.tracks[0], userPlaylist.tracks)
                      }
                      className="h-11 px-6 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-sm font-semibold flex items-center gap-2 shadow-lg hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = Math.floor(
                          Math.random() * userPlaylist.tracks.length
                        );
                        playTrack(userPlaylist.tracks[idx], userPlaylist.tracks);
                      }}
                      className="h-11 px-5 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 hover:brightness-110 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>Shuffle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void startRadio(userPlaylist.tracks[0])}
                      className="h-11 px-4 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 hover:text-[var(--m3-primary)] transition-colors"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Radio</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* In-List Quick Filter */}
        {userPlaylist.tracks.length > 0 && (
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              placeholder="Filter tracks in playlist..."
              aria-label="Filter playlist tracks"
              className="w-full h-10 pl-10 pr-9 rounded-full metro-surface text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
            />
            {trackFilter && (
              <button
                type="button"
                onClick={() => setTrackFilter('')}
                aria-label="Clear track filter"
                className="w-8 h-8 rounded-full flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {userPlaylist.tracks.length === 0 ? (
          <div className="rounded-[28px] metro-surface p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            This playlist is empty. Use the menu on any song to add tracks here.
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="rounded-[28px] metro-surface p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No tracks match &ldquo;{trackFilter}&rdquo;.
          </div>
        ) : (
          <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
            {filteredTracks.map((track, idx) => {
              const active = currentTrack?.videoId === track.videoId;
              return (
                <div
                  key={`${track.videoId}-${idx}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 first:rounded-t-[28px] last:rounded-b-[28px]',
                    active && 'bg-[var(--m3-primary-soft)]'
                  )}
                >
                  <span className="w-6 text-center text-xs font-mono-nums text-slate-400 shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => playTrack(track, filteredTracks)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <ArtworkImage
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-11 h-11"
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

                  <button
                    type="button"
                    onClick={() =>
                      removeTrackFromPlaylist(userPlaylist.id, track.videoId)
                    }
                    aria-label={`Remove ${track.title} from playlist`}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-slate-400 hover:text-[var(--m3-primary)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <TrackContextMenu track={track} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Remote Album / Playlist / Artist Detail (Immersive Adaptive Hero)
  const title = remote?.title || detailTarget.title || 'Loading...';
  const thumb = remote?.thumbnail || detailTarget.thumbnail || '';
  const saved = isSavedInCollection(detailTarget.kind, detailTarget.id);

  return (
    <div data-testid="detail-view" className="space-y-6 pb-36">
      {loading ? (
        <>
          <button
            type="button"
            onClick={() => openDetail(null)}
            className="h-10 px-4 rounded-full metro-surface inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <DetailViewSkeleton />
        </>
      ) : error ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => openDetail(null)}
            className="h-10 px-4 rounded-full metro-surface inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="rounded-[28px] metro-surface p-8 text-center text-sm text-[var(--m3-primary)]">
            {error}
          </div>
        </div>
      ) : remote ? (
        <>
          {/* Immersive Adaptive Blurred Artwork Hero */}
          <section className="relative overflow-hidden rounded-[32px] metro-surface p-5 sm:p-7">
            {thumb && (
              <>
                <img
                  src={thumb}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-25 dark:opacity-32"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--m3-surface)]/50 via-[var(--m3-surface)]/78 to-[var(--m3-surface)]" />
              </>
            )}

            <div className="relative z-10 space-y-5">
              <button
                type="button"
                onClick={() => openDetail(null)}
                className="h-10 px-4 rounded-full bg-black/[0.06] dark:bg-white/[0.1] backdrop-blur-md inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white hover:brightness-110 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-7">
                <ArtworkImage
                  src={thumb}
                  alt={title}
                  className="w-40 h-40 sm:w-52 sm:h-52 shadow-2xl shrink-0"
                  rounded={remote.kind === 'artist' ? 'rounded-full' : 'rounded-[26px]'}
                  sizeHint="lg"
                />

                <div className="space-y-3 flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--m3-primary)]">
                    {remote.kind}
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight">
                    {remote.title}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {remote.subtitle}
                    {remote.tracks.length > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-nums">
                          {remote.tracks.length} tracks · {totalDurationLabel}
                        </span>
                      </>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {remote.tracks.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => playTrack(remote.tracks[0], remote.tracks)}
                          className="h-11 px-6 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-sm font-semibold flex items-center gap-2 shadow-lg hover:brightness-110 transition-all"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Play All</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const idx = Math.floor(
                              Math.random() * remote.tracks.length
                            );
                            playTrack(remote.tracks[idx], remote.tracks);
                          }}
                          className="h-11 px-5 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 hover:brightness-110 transition-all"
                        >
                          <Shuffle className="w-4 h-4" />
                          <span>Shuffle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void startRadio(remote.tracks[0])}
                          className="h-11 px-4 rounded-full bg-black/[0.06] dark:bg-white/[0.1] text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 hover:text-[var(--m3-primary)] transition-colors"
                        >
                          <Radio className="w-4 h-4" />
                          <span>Radio</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        toggleSaveCollection({
                          kind: remote.kind,
                          id: remote.id,
                          title: remote.title,
                          subtitle: remote.subtitle,
                          thumbnail: remote.thumbnail,
                        })
                      }
                      className={cn(
                        'h-11 px-4 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors',
                        saved
                          ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                          : 'bg-black/[0.06] dark:bg-white/[0.1] text-slate-900 dark:text-white'
                      )}
                    >
                      <Bookmark className={cn('w-4 h-4', saved && 'fill-current')} />
                      <span>{saved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* In-List Track Search */}
          {remote.tracks.length > 4 && (
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                placeholder="Filter tracks..."
                aria-label="Filter detail tracks"
                className="w-full h-10 pl-10 pr-9 rounded-full metro-surface text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
              />
              {trackFilter && (
                <button
                  type="button"
                  onClick={() => setTrackFilter('')}
                  aria-label="Clear track filter"
                  className="w-8 h-8 rounded-full flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Tracks */}
          {filteredTracks.length > 0 && (
            <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {filteredTracks.map((track, idx) => {
                const active = currentTrack?.videoId === track.videoId;
                return (
                  <div
                    key={`${track.videoId}-${idx}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 first:rounded-t-[28px] last:rounded-b-[28px]',
                      active && 'bg-[var(--m3-primary-soft)]'
                    )}
                  >
                    <span className="w-6 text-center text-xs font-mono-nums text-slate-400 shrink-0">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => playTrack(track, filteredTracks)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-11 h-11"
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
          )}

          {/* Artist Albums */}
          {remote.albums && remote.albums.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Albums & Singles
              </h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {remote.albums.map((alb) => (
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
                    className="w-40 shrink-0 text-left p-2.5 rounded-[22px] metro-surface hover:bg-[var(--m3-surface-high)] transition-colors space-y-2"
                  >
                    <ArtworkImage
                      src={alb.thumbnail}
                      alt={alb.title}
                      className="w-full aspect-square"
                      rounded="rounded-2xl"
                    />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {alb.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {alb.year || 'Album'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
