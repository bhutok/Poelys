export type MediaItemType = 'SONG' | 'VIDEO';

export interface ArtistRef {
  artistId: string | null;
  name: string;
}

export interface AlbumRef {
  albumId: string;
  name: string;
}

export interface Track {
  videoId: string;
  title: string;
  artist: string;
  artists: ArtistRef[];
  album?: AlbumRef | null;
  duration: number | null; // seconds
  thumbnail: string;
  type: MediaItemType;
  explicit?: boolean;
}

export interface AlbumSummary {
  type: 'ALBUM';
  albumId: string;
  playlistId: string;
  title: string;
  artist: string;
  artists: ArtistRef[];
  year: number | null;
  thumbnail: string;
}

export interface PlaylistSummary {
  type: 'PLAYLIST';
  playlistId: string;
  title: string;
  artist: string;
  thumbnail: string;
  trackCount?: number;
}

export interface ArtistSummary {
  type: 'ARTIST';
  artistId: string;
  name: string;
  thumbnail: string;
}

export type HomeShelfItem =
  | (Track & { kind: 'TRACK' })
  | (AlbumSummary & { kind: 'ALBUM' })
  | (PlaylistSummary & { kind: 'PLAYLIST' })
  | (ArtistSummary & { kind: 'ARTIST' });

export interface HomeShelf {
  id: string;
  title: string;
  subtitle?: string;
  items: HomeShelfItem[];
}

export interface PlayEvent {
  track: Track;
  playCount: number;
  lastPlayedAt: number; // epoch ms
  firstPlayedAt: number; // epoch ms
}

export interface UserPlaylist {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  tracks: Track[];
  coverUrl?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type ThemeMode = 'dark' | 'light';

export type AccentPreset = 'metrolist' | 'rose' | 'emerald' | 'violet' | 'amber';

export type ContentRegion = 'ID' | 'US' | 'JP' | 'KR' | 'GB';

export type DockStyle = 'default' | 'liquid-glass';

export type PlayerBackgroundStyle =
  | 'BLURRED_ARTWORK'
  | 'SOLID'
  | 'GRADIENT'
  | 'ANIMATED_GRADIENT'
  | 'LIQUID';

export type SliderStyle = 'DEFAULT' | 'SQUIGGLY' | 'WAVY' | 'SLIM';

export type PlayerControlsStyle = 'EXPRESSIVE' | 'CLASSIC';

export type AodClockStyle = 'BOLD' | 'MINIMAL' | 'STACKED';

export type AodArtworkShape = 'ROUNDED' | 'CIRCLE' | 'SQUIRCLE' | 'ARCH' | 'DIAMOND';

export type AodBackgroundStyle = 'PURE_BLACK' | 'AMBIENT_GLOW' | 'ADAPTIVE_ART';

export type EqualizerPreset =
  | 'FLAT'
  | 'BASS_BOOST'
  | 'VOCAL'
  | 'ACOUSTIC'
  | 'ELECTRONIC'
  | 'LATE_NIGHT'
  | 'CUSTOM';

export type LyricsAnimationStyle =
  | 'APPLE'
  | 'BRACCATO'
  | 'EXPRESSIVE'
  | 'SIMPLE'
  | 'NONE';

export type LyricsTextPosition = 'LEFT' | 'CENTER' | 'RIGHT';

export type BackgroundPopupMode =
  | 'off'
  | 'document-pip'
  | 'video-pip'
  | 'floating-overlay';

export interface PlayerSettings {
  theme: ThemeMode;
  pureBlack: boolean;
  dynamicColor: boolean;
  accentPreset: AccentPreset;
  dockStyle: DockStyle;
  playerBackgroundStyle: PlayerBackgroundStyle;
  sliderStyle: SliderStyle;
  playerControlsStyle: PlayerControlsStyle;
  aodClockStyle: AodClockStyle;
  aodArtworkShape: AodArtworkShape;
  aodBackgroundStyle: AodBackgroundStyle;
  equalizerPreset: EqualizerPreset;
  equalizerBands: number[]; // 5 bands: 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz (-12..+12 dB)
  bassBoostEnabled: boolean;
  thumbnailCornerRadius: number; // 8 | 16 | 24 | 32
  swipeToChangeTrack: boolean;
  // Lyrics display & animation engine (ported from Metrolist)
  lyricsAnimationStyle: LyricsAnimationStyle;
  lyricsTextPosition: LyricsTextPosition;
  lyricsFontSize: number; // 18..34 px
  lyricsLineSpacing: number; // 1.0..2.2x
  lyricsProgressiveBlur: boolean;
  lyricsNeutralColor: boolean;
  lyricsClickToSeek: boolean;
  lyricsAutoScroll: boolean;
  lyricsGlobalOffsetMs: number; // -2000..2000 ms
  // Playback & content behavior
  region: ContentRegion;
  hideVideoSongs: boolean;
  autoContinueRadio: boolean;
  backgroundPlay: boolean;
  autoPopoutIsland: boolean;
  playbackRate: number;
  seekDurationSeconds: number; // 5 | 10 | 15 | 30
  keepPausedOnSongChange: boolean;
  autoSkipOnError: boolean;
  ytCookie: string;
}

export interface LyricWord {
  startSec: number;
  endSec: number;
  text: string;
}

export interface LyricLine {
  timeSec: number;
  endTimeSec?: number;
  text: string;
  words?: LyricWord[];
}

export interface LyricsPayload {
  synced: boolean;
  lines: LyricLine[];
  plainText: string | null;
  source: 'lrclib' | 'ytmusic' | 'none';
}

export type NavTab = 'home' | 'search' | 'charts' | 'library' | 'settings';

export type DetailTarget =
  | { kind: 'album'; id: string; title?: string; thumbnail?: string }
  | { kind: 'playlist'; id: string; title?: string; thumbnail?: string }
  | { kind: 'artist'; id: string; title?: string; thumbnail?: string }
  | { kind: 'user-playlist'; id: string };
