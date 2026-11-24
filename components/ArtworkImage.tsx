'use client';

import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtworkImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  rounded?: string;
  sizeHint?: 'sm' | 'md' | 'lg';
}

const GRADIENT_FALLBACKS = [
  'from-rose-500/30 via-amber-500/20 to-slate-800/40',
  'from-indigo-500/30 via-sky-500/20 to-slate-900/40',
  'from-emerald-500/25 via-teal-500/20 to-slate-900/40',
  'from-fuchsia-500/25 via-rose-500/20 to-slate-900/40',
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function ArtworkImage({
  src,
  alt,
  className,
  rounded = 'rounded-xl',
  sizeHint = 'md',
}: ArtworkImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const gradientClass =
    GRADIENT_FALLBACKS[hashString(alt || 'Poelys') % GRADIENT_FALLBACKS.length];

  const isFailed = !src || failedSrc === src;
  const isLoaded = !!src && loadedSrc === src;
  const isLetterboxedYtThumb = !!src && src.includes('i.ytimg.com') && src.includes('hqdefault.jpg');

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-200 dark:bg-white/[0.06] shrink-0 select-none',
        rounded,
        className
      )}
    >
      {/* Persistent gradient + note under-layer while loading or on error */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center bg-gradient-to-br',
          gradientClass
        )}
        aria-hidden={!isFailed}
      >
        <Music2
          className={cn(
            'text-slate-600/60 dark:text-white/40',
            sizeHint === 'sm' ? 'w-4 h-4' : sizeHint === 'lg' ? 'w-12 h-12' : 'w-6 h-6'
          )}
        />
      </div>

      {!isFailed && (
        <img
          key={src}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={cn(
            'relative z-10 w-full h-full object-cover transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0',
            isLetterboxedYtThumb && 'scale-[1.35]'
          )}
        />
      )}
    </div>
  );
}
