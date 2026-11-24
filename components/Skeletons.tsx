'use client';

import React from 'react';

export function HomeShelvesSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading music shelves"
      className="space-y-8"
    >
      {[0, 1].map((shelfIdx) => (
        <section key={`skel-shelf-${shelfIdx}`} className="space-y-3">
          <div className="h-6 w-44 rounded-lg skeleton-block" />
          <div className="flex gap-4 overflow-hidden pb-2">
            {[0, 1, 2, 3, 4, 5].map((cardIdx) => (
              <div
                key={`skel-card-${shelfIdx}-${cardIdx}`}
                className="w-40 sm:w-44 shrink-0 space-y-2.5"
              >
                <div className="w-40 h-40 sm:w-44 sm:h-44 rounded-2xl skeleton-block" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded-md skeleton-block" />
                  <div className="h-3 w-1/2 rounded-md skeleton-block" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function QuickPicksSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading quick picks"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
    >
      {[0, 1, 2].map((col) => (
        <div
          key={`skel-qp-col-${col}`}
          className="rounded-3xl metro-surface p-2 space-y-1"
        >
          {[0, 1, 2, 3].map((row) => (
            <div
              key={`skel-qp-${col}-${row}`}
              className="flex items-center gap-3 p-2"
            >
              <div className="w-12 h-12 rounded-xl skeleton-block shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3.5 w-3/4 rounded-md skeleton-block" />
                <div className="h-3 w-1/2 rounded-md skeleton-block" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TrendingGenreSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading trending songs by genre"
      className="flex gap-4 overflow-hidden pb-1"
    >
      {[0, 1].map((col) => (
        <div
          key={`skel-tg-col-${col}`}
          className="w-[84vw] max-w-[360px] sm:w-[350px] shrink-0 space-y-3"
        >
          {[0, 1, 2].map((row) => (
            <div
              key={`skel-tg-${col}-${row}`}
              className="flex items-center gap-3.5 py-1"
            >
              <div className="w-14 h-14 rounded-xl skeleton-block shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-4/5 rounded-md skeleton-block" />
                <div className="h-3.5 w-1/2 rounded-md skeleton-block" />
              </div>
              <div className="w-7 h-7 rounded-full skeleton-block shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading tracks"
      className="rounded-3xl metro-surface divide-y divide-black/5 dark:divide-white/[0.06]"
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={`skel-row-${idx}`} className="flex items-center gap-3 px-4 py-2.5">
          <div className="w-5 h-3.5 rounded skeleton-block shrink-0" />
          <div className="w-12 h-12 rounded-xl skeleton-block shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-2/3 sm:w-1/2 rounded-md skeleton-block" />
            <div className="h-3 w-1/2 sm:w-1/3 rounded-md skeleton-block" />
          </div>
          <div className="w-8 h-8 rounded-full skeleton-block shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading search results"
      className="space-y-8"
    >
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-lg skeleton-block" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`skel-col-${i}`}
              className="p-2.5 rounded-2xl metro-surface space-y-2.5"
            >
              <div className="w-full aspect-square rounded-xl skeleton-block" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-4/5 rounded-md skeleton-block" />
                <div className="h-3 w-1/2 rounded-md skeleton-block" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-5 w-36 rounded-lg skeleton-block" />
        <TrackListSkeleton rows={6} />
      </div>
    </div>
  );
}

export function DetailViewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading collection details"
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
        <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl skeleton-block shrink-0" />
        <div className="space-y-3 flex-1 w-full">
          <div className="h-8 w-3/4 sm:w-72 rounded-xl skeleton-block" />
          <div className="h-4 w-48 rounded-lg skeleton-block" />
          <div className="flex items-center gap-2.5 pt-1">
            <div className="h-10 w-28 rounded-xl skeleton-block" />
            <div className="h-10 w-24 rounded-xl skeleton-block" />
            <div className="h-10 w-24 rounded-xl skeleton-block" />
          </div>
        </div>
      </div>

      <TrackListSkeleton rows={7} />
    </div>
  );
}
