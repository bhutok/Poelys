import { NextRequest, NextResponse } from 'next/server';
import { parseLrcLyrics } from '@/lib/metrolist/lyrics';
import type { LyricsPayload } from '@/lib/metrolist/types';
import { getYTMusicClient } from '@/lib/server/ytmusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = (searchParams.get('videoId') || '').trim();
  const title = (searchParams.get('title') || '').trim();
  const artist = (searchParams.get('artist') || '').trim();
  const duration = Number(searchParams.get('duration') || '0');

  if (!videoId) {
    return NextResponse.json<LyricsPayload>({
      synced: false,
      lines: [],
      plainText: null,
      source: 'none',
    });
  }

  // 1. Try YouTube Music timed lyrics first
  try {
    const yt = await getYTMusicClient();
    const timed = await yt.getTimedLyrics(videoId);
    if (timed && timed.length > 0) {
      return NextResponse.json<LyricsPayload>({
        synced: true,
        lines: timed.map((t) => ({
          timeSec: t.startTime / 1000,
          text: t.text,
        })),
        plainText: timed.map((t) => t.text).join('\n'),
        source: 'ytmusic',
      });
    }
  } catch {
    // Fallback to LRCLIB below
  }

  // 2. Try LRCLIB (same synced lyrics source Metrolist uses!)
  if (title && artist) {
    try {
      const cleanTitle = title.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '').trim();
      const cleanArtist = artist.split(/,|feat\.|ft\./i)[0].trim();
      const lrcUrl = new URL('https://lrclib.net/api/get');
      lrcUrl.searchParams.set('track_name', cleanTitle);
      lrcUrl.searchParams.set('artist_name', cleanArtist);
      if (duration > 0) {
        lrcUrl.searchParams.set('duration', String(Math.round(duration)));
      }

      const lrcRes = await fetch(lrcUrl.toString(), {
        headers: { 'User-Agent': 'PoelysMusicWeb/1.0 (https://github.com)' },
        signal: AbortSignal.timeout(4500),
      });

      if (lrcRes.ok) {
        const data = (await lrcRes.json()) as {
          syncedLyrics?: string;
          plainLyrics?: string;
        };
        if (data.syncedLyrics) {
          const lines = parseLrcLyrics(data.syncedLyrics);
          if (lines.length > 0) {
            return NextResponse.json<LyricsPayload>({
              synced: true,
              lines,
              plainText: data.plainLyrics || lines.map((l) => l.text).join('\n'),
              source: 'lrclib',
            });
          }
        }
        if (data.plainLyrics) {
          return NextResponse.json<LyricsPayload>({
            synced: false,
            lines: [],
            plainText: data.plainLyrics,
            source: 'lrclib',
          });
        }
      }
    } catch {
      // Fallback to plain YouTube Music lyrics
    }
  }

  // 3. Fallback to plain YouTube Music lyrics
  try {
    const yt = await getYTMusicClient();
    const plainLines = await yt.getLyrics(videoId);
    if (plainLines && plainLines.length > 0) {
      return NextResponse.json<LyricsPayload>({
        synced: false,
        lines: [],
        plainText: plainLines.join('\n'),
        source: 'ytmusic',
      });
    }
  } catch {
    // No lyrics found
  }

  return NextResponse.json<LyricsPayload>({
    synced: false,
    lines: [],
    plainText: null,
    source: 'none',
  });
}
