'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  LIQUID_GLASS_PRESETS,
  type LiquidGlassPresetName,
  buildLiquidGlassMaps,
} from '@/lib/liquid-glass/refraction';
import { cn } from '@/lib/utils';

interface RegisteredFilterEntry {
  id: string;
  key: string;
  preset: LiquidGlassPresetName;
  width: number;
  height: number;
  scale: number;
  blurLevel: number;
  specularOpacity: number;
  specularSaturation: number;
  displacementUrl: string;
  specularUrl: string;
  ready: boolean;
}

const FILTER_REGISTRY = new Map<string, RegisteredFilterEntry>();
const MAX_REGISTRY_ENTRIES = 36;
const REGISTRY_LISTENERS = new Set<() => void>();
let REGISTRY_SNAPSHOT: RegisteredFilterEntry[] = [];

const emptySubscribe = () => () => {};

function notifyRegistry() {
  REGISTRY_SNAPSHOT = Array.from(FILTER_REGISTRY.values());
  REGISTRY_LISTENERS.forEach((fn) => fn());
}

function subscribeRegistry(listener: () => void) {
  REGISTRY_LISTENERS.add(listener);
  return () => {
    REGISTRY_LISTENERS.delete(listener);
  };
}

function getRegistrySnapshot(): RegisteredFilterEntry[] {
  return REGISTRY_SNAPSHOT;
}

const EMPTY_REGISTRY: RegisteredFilterEntry[] = [];
function getServerRegistrySnapshot(): RegisteredFilterEntry[] {
  return EMPTY_REGISTRY;
}

/**
 * Detects Chromium-based engines that support SVG filter URLs inside CSS `backdrop-filter`.
 * Safari & Firefox gracefully fall back to crystal CSS optics.
 */
function detectChromiumSvgBackdropSupport(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isChromium =
    /Chrome|Chromium|Edg|OPR|Brave|CriOS/i.test(ua) && !/Firefox/i.test(ua);
  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('backdrop-filter', 'blur(1px)');
  return isChromium && supportsBackdrop;
}

function pixelsToPngDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function decodeDataUrl(url: string): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    return img.decode().catch(() => {});
  }
  return new Promise((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

function makeFilterKey(
  preset: LiquidGlassPresetName,
  width: number,
  height: number,
  radius: number
): string {
  return `${preset}-${width}x${height}-r${radius}`;
}

/**
 * Builds, caches, and pre-decodes the Snell's Law displacement + specular PNGs
 * into the persistent SVG `<defs>` registry. Because filters stay permanently
 * mounted in `<LiquidGlassFilterDefs />`, toggling between expanded and compact
 * layouts on scroll never tears down or re-decodes SVG filters (zero transparent flash).
 */
export function registerLiquidGlassFilter(
  preset: LiquidGlassPresetName,
  width: number,
  height: number,
  radius?: number
): RegisteredFilterEntry | null {
  if (typeof document === 'undefined' || width < 4 || height < 4) return null;

  const qW = Math.max(4, Math.round(width / 2) * 2);
  const qH = Math.max(4, Math.round(height / 2) * 2);
  const effectiveRadius =
    radius !== undefined
      ? Math.round(radius)
      : Math.round(Math.min(qW, qH) * 0.5);

  const key = makeFilterKey(preset, qW, qH, effectiveRadius);
  const existing = FILTER_REGISTRY.get(key);
  if (existing) return existing;

  const presetConfig = LIQUID_GLASS_PRESETS[preset];
  const bundle = buildLiquidGlassMaps({
    width: qW,
    height: qH,
    radius: effectiveRadius,
    preset: presetConfig,
  });

  const displacementUrl = pixelsToPngDataUrl(
    bundle.displacementPixels,
    bundle.width,
    bundle.height
  );
  const specularUrl = pixelsToPngDataUrl(
    bundle.specularPixels,
    bundle.width,
    bundle.height
  );

  if (!displacementUrl || !specularUrl) return null;

  const entry: RegisteredFilterEntry = {
    id: `kube-lg-${key}`,
    key,
    preset,
    width: bundle.width,
    height: bundle.height,
    scale: bundle.scale,
    blurLevel: presetConfig.blurLevel,
    specularOpacity: presetConfig.specularOpacity,
    specularSaturation: presetConfig.specularSaturation,
    displacementUrl,
    specularUrl,
    ready: false,
  };

  if (FILTER_REGISTRY.size >= MAX_REGISTRY_ENTRIES) {
    const oldestKey = FILTER_REGISTRY.keys().next().value;
    if (oldestKey) FILTER_REGISTRY.delete(oldestKey);
  }
  FILTER_REGISTRY.set(key, entry);
  notifyRegistry();

  // Pre-decode both PNG data URLs in Chromium before switching from CSS blur to SVG url(#...)
  // so the glass surface NEVER flashes unblurred/transparent while feImage decodes.
  void Promise.all([
    decodeDataUrl(displacementUrl),
    decodeDataUrl(specularUrl),
  ]).then(() => {
    const current = FILTER_REGISTRY.get(key);
    if (current && !current.ready) {
      FILTER_REGISTRY.set(key, { ...current, ready: true });
      notifyRegistry();
    }
  });

  return entry;
}

/**
 * Persistent off-screen `<svg>` `<defs>` host rendered once at the dock / MiniPlayer root.
 * Keeps all compiled kube.io SVG refraction filters alive across scroll morphs and tab switches.
 * Unmounts cleanly when the user switches to `Default` mode in Settings.
 */
export function LiquidGlassFilterDefs() {
  const supportsSvgBackdrop = useSyncExternalStore(
    emptySubscribe,
    detectChromiumSvgBackdropSupport,
    () => false
  );
  const entries = useSyncExternalStore(
    subscribeRegistry,
    getRegistrySnapshot,
    getServerRegistrySnapshot
  );

  if (!supportsSvgBackdrop || entries.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      className="fixed w-0 h-0 pointer-events-none overflow-hidden"
      colorInterpolationFilters="sRGB"
    >
      <defs>
        {entries.map((entry) => (
          <filter
            key={entry.id}
            id={entry.id}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation={entry.blurLevel}
              edgeMode="duplicate"
              result="blurred_source"
            />
            <feImage
              href={entry.displacementUrl}
              x="0"
              y="0"
              width={entry.width}
              height={entry.height}
              preserveAspectRatio="none"
              result="displacement_map"
            />
            <feDisplacementMap
              in="blurred_source"
              in2="displacement_map"
              scale={entry.scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="saturate"
              values={String(entry.specularSaturation)}
              result="displaced_saturated"
            />
            <feImage
              href={entry.specularUrl}
              x="0"
              y="0"
              width={entry.width}
              height={entry.height}
              preserveAspectRatio="none"
              result="specular_layer"
            />
            <feComposite
              in="displaced_saturated"
              in2="specular_layer"
              operator="in"
              result="specular_saturated"
            />
            <feComponentTransfer in="specular_layer" result="specular_faded">
              <feFuncA type="linear" slope={entry.specularOpacity} />
            </feComponentTransfer>
            <feBlend
              in="specular_saturated"
              in2="displaced"
              mode="normal"
              result="withSaturation"
            />
            <feBlend in="specular_faded" in2="withSaturation" mode="normal" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

interface LiquidGlassBackdropLayerProps {
  preset?: LiquidGlassPresetName;
  /** Optional explicit initial dimensions before ResizeObserver fires */
  fallbackWidth?: number;
  fallbackHeight?: number;
  /** Optional custom border-radius in px (defaults to pill/circle = min(w, h) / 2) */
  borderRadius?: number;
  className?: string;
}

/**
 * Pure optical backdrop layer implementing the kube.io CSS + SVG Liquid Glass
 * refraction pipeline (`feGaussianBlur` -> `feDisplacementMap` -> `feColorMatrix`
 * saturate -> directional `feImage` specular rim -> `feBlend`) via
 * `backdrop-filter: url(#filterId)`.
 *
 * Uses the persistent `<LiquidGlassFilterDefs />` registry so filters stay
 * pre-decoded and mounted across scroll transitions (zero transparent blur drops).
 */
export function LiquidGlassBackdropLayer({
  preset = 'pill',
  fallbackWidth = 0,
  fallbackHeight = 0,
  borderRadius,
  className,
}: LiquidGlassBackdropLayerProps) {
  const supportsSvgBackdrop = useSyncExternalStore(
    emptySubscribe,
    detectChromiumSvgBackdropSupport,
    () => false
  );
  const registryEntries = useSyncExternalStore(
    subscribeRegistry,
    getRegistrySnapshot,
    getServerRegistrySnapshot
  );

  const layerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: fallbackWidth,
    height: fallbackHeight,
  });

  useEffect(() => {
    if (!supportsSvgBackdrop) return;
    const el = layerRef.current;
    if (!el) return;

    const updateSize = (w: number, h: number) => {
      const qW = Math.max(4, Math.round(w / 2) * 2);
      const qH = Math.max(4, Math.round(h / 2) * 2);
      setSize((prev) =>
        prev.width === qW && prev.height === qH ? prev : { width: qW, height: qH }
      );
    };

    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      updateSize(el.offsetWidth, el.offsetHeight);
    }

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      const w = box ? box.inlineSize : el.offsetWidth;
      const h = box ? box.blockSize : el.offsetHeight;
      if (w > 0 && h > 0) {
        updateSize(w, h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [supportsSvgBackdrop]);

  const effectiveRadius =
    borderRadius !== undefined
      ? Math.round(borderRadius)
      : Math.round(Math.min(size.width, size.height) * 0.5);

  const filterKey =
    size.width >= 4 && size.height >= 4
      ? makeFilterKey(
          preset,
          Math.max(4, Math.round(size.width / 2) * 2),
          Math.max(4, Math.round(size.height / 2) * 2),
          effectiveRadius
        )
      : '';

  useEffect(() => {
    if (!supportsSvgBackdrop || size.width < 4 || size.height < 4) return;
    registerLiquidGlassFilter(preset, size.width, size.height, effectiveRadius);
  }, [supportsSvgBackdrop, preset, size.width, size.height, effectiveRadius]);

  const activeEntry = filterKey
    ? registryEntries.find((e) => e.key === filterKey && e.ready)
    : undefined;

  const fallbackClass =
    preset === 'orb'
      ? 'ios27-liquid-glass-orb'
      : preset === 'droplet'
        ? 'ios27-liquid-droplet-dragging'
        : 'ios27-liquid-glass';

  const svgActiveClass =
    preset === 'orb'
      ? 'kube-liquid-glass-orb'
      : preset === 'droplet'
        ? 'kube-liquid-glass-droplet'
        : 'kube-liquid-glass-pill';

  const isSvgActive = Boolean(activeEntry);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-liquid-glass-engine={isSvgActive ? 'kube-svg-refraction' : 'css-fallback'}
      data-liquid-glass-preset={preset}
      data-liquid-glass-filter={activeEntry?.id}
      style={
        activeEntry
          ? {
              backdropFilter: `url(#${activeEntry.id})`,
              WebkitBackdropFilter: `url(#${activeEntry.id})`,
            }
          : undefined
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-full',
        isSvgActive ? svgActiveClass : fallbackClass,
        className
      )}
    />
  );
}
