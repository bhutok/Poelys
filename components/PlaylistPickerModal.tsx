'use client';

import React, { useState } from 'react';
import { Check, ListMusic, Plus, X } from 'lucide-react';
import { useMusic } from './MusicProvider';

export function PlaylistPickerModal() {
  const {
    playlistPickerTrack,
    openPlaylistPicker,
    playlists,
    addTrackToPlaylist,
    createPlaylist,
  } = useMusic();

  const [newName, setNewName] = useState('');

  if (!playlistPickerTrack) return null;

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = createPlaylist(newName.trim(), '', [playlistPickerTrack]);
    setNewName('');
    if (created) {
      openPlaylistPicker(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to Playlist"
      onClick={() => openPlaylistPicker(null)}
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl liquid-glass-elevated p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Add to Playlist
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {playlistPickerTrack.title} · {playlistPickerTrack.artist}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openPlaylistPicker(null)}
            aria-label="Close playlist picker"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new playlist inline */}
        <form onSubmit={handleCreateAndAdd} className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name..."
            aria-label="New playlist name"
            className="flex-1 h-11 px-3.5 rounded-xl bg-black/5 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="h-11 px-4 rounded-xl bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </form>

        {/* Existing playlists */}
        <div className="max-h-60 overflow-y-auto space-y-1.5">
          {playlists.map((pl) => {
            const alreadyIn = pl.tracks.some(
              (t) => t.videoId === playlistPickerTrack.videoId
            );
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => {
                  addTrackToPlaylist(pl.id, playlistPickerTrack);
                  openPlaylistPicker(null);
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[var(--m3-primary-soft)] flex items-center justify-center shrink-0">
                    <ListMusic className="w-4 h-4 text-[var(--m3-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {pl.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                      {pl.tracks.length} tracks
                    </p>
                  </div>
                </div>

                {alreadyIn && (
                  <Check className="w-4 h-4 text-[var(--m3-primary)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
