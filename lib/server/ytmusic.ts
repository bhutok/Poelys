import YTMusic, {
  type AlbumDetailed,
  type ArtistDetailed,
  type HomeSection,
  type PlaylistDetailed,
  type SearchResult,
  type SongDetailed,
  type ThumbnailFull,
  type VideoDetailed,
} from 'ytmusic-api';
import type {
  AlbumSummary,
  ArtistSummary,
  HomeShelf,
  HomeShelfItem,
  PlaylistSummary,
  Track,
} from '@/lib/metrolist/types';

const clientPool = new Map<string, Promise<YTMusic>>();

export async function getYTMusicClient(options?: {
  gl?: string;
  hl?: string;
  cookies?: string;
}): Promise<YTMusic> {
  const gl = (options?.gl || 'ID').toUpperCase();
  const hl = options?.hl || 'en';
  const cookies = options?.cookies?.trim() || '';
  const key = `${gl}:${hl}:${cookies ? cookies.slice(0, 24) : 'anon'}`;

  let pending = clientPool.get(key);
  if (!pending) {
    const client = new YTMusic();
    pending = client
      .initialize({
        GL: gl,
        HL: hl,
        cookies: cookies || undefined,
        timeout: 15000,
        cache: {
          ttl: 5 * 60 * 1000,
          size: 120,
        },
        retry: {
          retries: 2,
          delay: 600,
        },
      })
      .catch((err) => {
        clientPool.delete(key);
        throw err;
      });
    clientPool.set(key, pending);
  }
  return pending;
}

export function pickBestThumbnail(
  thumbnails: ThumbnailFull[] | undefined,
  fallbackVideoId?: string
): string {
  if (!thumbnails || thumbnails.length === 0) {
    return fallbackVideoId
      ? `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg`
      : '';
  }

  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  let url = sorted[0]?.url || '';

  // Upgrade small lh3.googleusercontent.com / yt3.ggpht.com thumbnails to crisp 360px
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    url = url.replace(/=w\d+-h\d+[^&]*/, '=w360-h360-l90-rj');
  }
  return url;
}

export function normalizeSong(item: SongDetailed): Track {
  const artistNames =
    item.artists && item.artists.length > 0
      ? item.artists.map((a) => a.name).join(', ')
      : item.artist?.name || 'Unknown Artist';

  return {
    videoId: item.videoId,
    title: item.name,
    artist: artistNames,
    artists:
      item.artists && item.artists.length > 0
        ? item.artists
        : item.artist
        ? [item.artist]
        : [],
    album: item.album || null,
    duration: item.duration ?? null,
    thumbnail: pickBestThumbnail(item.thumbnails, item.videoId),
    type: 'SONG',
    explicit: item.explicit,
  };
}

export function normalizeVideo(item: VideoDetailed): Track {
  const artistNames =
    item.artists && item.artists.length > 0
      ? item.artists.map((a) => a.name).join(', ')
      : item.artist?.name || 'Unknown Artist';

  return {
    videoId: item.videoId,
    title: item.name,
    artist: artistNames,
    artists:
      item.artists && item.artists.length > 0
        ? item.artists
        : item.artist
        ? [item.artist]
        : [],
    album: null,
    duration: item.duration ?? null,
    thumbnail: pickBestThumbnail(item.thumbnails, item.videoId),
    type: 'VIDEO',
  };
}

export function normalizeAlbum(item: AlbumDetailed): AlbumSummary {
  const artistNames =
    item.artists && item.artists.length > 0
      ? item.artists.map((a) => a.name).join(', ')
      : item.artist?.name || 'Various Artists';

  return {
    type: 'ALBUM',
    albumId: item.albumId,
    playlistId: item.playlistId,
    title: item.name,
    artist: artistNames,
    artists:
      item.artists && item.artists.length > 0
        ? item.artists
        : item.artist
        ? [item.artist]
        : [],
    year: item.year ?? null,
    thumbnail: pickBestThumbnail(item.thumbnails),
  };
}

export function normalizePlaylist(item: PlaylistDetailed): PlaylistSummary {
  return {
    type: 'PLAYLIST',
    playlistId: item.playlistId,
    title: item.name,
    artist: item.artist?.name || 'YouTube Music',
    thumbnail: pickBestThumbnail(item.thumbnails),
  };
}

export function normalizeArtist(item: ArtistDetailed): ArtistSummary {
  return {
    type: 'ARTIST',
    artistId: item.artistId,
    name: item.name,
    thumbnail: pickBestThumbnail(item.thumbnails),
  };
}

export function normalizeSearchItem(item: SearchResult): HomeShelfItem | null {
  switch (item.type) {
    case 'SONG':
      return { ...normalizeSong(item), kind: 'TRACK' };
    case 'VIDEO':
      return { ...normalizeVideo(item), kind: 'TRACK' };
    case 'ALBUM':
      return { ...normalizeAlbum(item), kind: 'ALBUM' };
    case 'PLAYLIST':
      return { ...normalizePlaylist(item), kind: 'PLAYLIST' };
    case 'ARTIST':
      return { ...normalizeArtist(item), kind: 'ARTIST' };
    default:
      return null;
  }
}

export function normalizeHomeSections(sections: HomeSection[]): HomeShelf[] {
  return sections
    .map((section, idx) => {
      const items: HomeShelfItem[] = [];
      for (const content of section.contents || []) {
        const normalized = normalizeSearchItem(content as SearchResult);
        if (normalized) items.push(normalized);
      }
      return {
        id: `ytm-shelf-${idx}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: section.title,
        items,
      };
    })
    .filter((s) => s.items.length > 0);
}
