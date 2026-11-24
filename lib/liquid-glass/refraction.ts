/**
 * Physics-based Liquid Glass optical refraction & specular highlight generator.
 * Implements the Snell–Descartes Law + SVG feDisplacementMap architecture from:
 * https://kube.io/blog/liquid-glass-css-svg/
 *
 * Pure TypeScript with zero DOM dependencies so all optics & pixel maps are
 * deterministic and unit-testable in Node.
 */

export type BezelSurfaceType =
  | 'convex-squircle'
  | 'convex-circle'
  | 'concave'
  | 'lip';

export type LiquidGlassPresetName = 'pill' | 'orb' | 'droplet';

export interface LiquidGlassOpticalPreset {
  name: LiquidGlassPresetName;
  surface: BezelSurfaceType;
  /** Curved bezel width in CSS pixels (clamped automatically to <= half min dimension) */
  bezelWidth: number;
  /** Virtual glass slab thickness in CSS pixels for Snell's Law ray tracing */
  glassThickness: number;
  /** Glass refractive index n2 (air n1 = 1.0; crown/optical glass = 1.5) */
  refractiveIndex: number;
  /** Multiplies maximumDisplacement for SVG feDisplacementMap scale */
  refractionLevel: number;
  /** Pre-displacement Gaussian blur stdDeviation (kept crisp & low for crystal glass) */
  blurLevel: number;
  /** Opacity multiplier (feFuncA slope) for the white directional specular rim */
  specularOpacity: number;
  /** Saturation multiplier (feColorMatrix) for chromatic rim refraction */
  specularSaturation: number;
  /** Primary light direction in degrees (-60 deg = upper-left specular highlight) */
  lightAngleDeg: number;
}

export const LIQUID_GLASS_PRESETS: Record<
  LiquidGlassPresetName,
  LiquidGlassOpticalPreset
> = {
  // Matches kube.io Music Player / Searchbar thick sculpted Convex Squircle glass wall
  pill: {
    name: 'pill',
    surface: 'convex-squircle',
    bezelWidth: 22,
    glassThickness: 62,
    refractiveIndex: 1.55,
    refractionLevel: 1.15,
    blurLevel: 1.35,
    specularOpacity: 0.58,
    specularSaturation: 9.0,
    lightAngleDeg: -60,
  },
  // Circular floating button / orb — thick convex glass lens marble
  orb: {
    name: 'orb',
    surface: 'convex-squircle',
    bezelWidth: 22,
    glassThickness: 64,
    refractiveIndex: 1.56,
    refractionLevel: 1.22,
    blurLevel: 1.2,
    specularOpacity: 0.62,
    specularSaturation: 10.0,
    lightAngleDeg: -58,
  },
  // Interactive draggable magnifying droplet (kube.io Slider / Magnifying Glass lip profile)
  droplet: {
    name: 'droplet',
    surface: 'lip',
    bezelWidth: 24,
    glassThickness: 72,
    refractiveIndex: 1.58,
    refractionLevel: 1.3,
    blurLevel: 0.35,
    specularOpacity: 0.68,
    specularSaturation: 12.0,
    lightAngleDeg: -55,
  },
};

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates normalized bezel height y = f(x) for x in [0, 1],
 * where x = 0 is the outer rim edge and x = 1 is the flat interior.
 */
export function evaluateSurfaceHeight(
  surface: BezelSurfaceType,
  rawX: number
): number {
  const x = clamp(rawX, 0, 1);
  switch (surface) {
    case 'convex-squircle': {
      // Apple Liquid Glass signature profile: y = (1 - (1 - x)^4)^(1/4)
      const inv = 1 - x;
      const inner = Math.max(0, 1 - inv * inv * inv * inv);
      return Math.pow(inner, 0.25);
    }
    case 'convex-circle': {
      // Circular arc: y = sqrt(1 - (1 - x)^2)
      const inv = 1 - x;
      return Math.sqrt(Math.max(0, 1 - inv * inv));
    }
    case 'concave': {
      // Bowl-like concave profile: y = 1 - sqrt(1 - x^2)
      return 1 - Math.sqrt(Math.max(0, 1 - x * x));
    }
    case 'lip': {
      // Smootherstep blend between convex outer rim and subtle concave dip (kube.io slider/switch)
      const inv = 1 - x;
      const convex = Math.pow(Math.max(0, 1 - inv * inv * inv * inv), 0.25);
      const concave = 1 - Math.sqrt(Math.max(0, 1 - x * x));
      // Smootherstep mix biased toward convex rim with a gentle inner lip transition
      const t = x * x * x * (x * (x * 6 - 15) + 10);
      return convex * (1 - t * 0.42) + concave * (t * 0.42);
    }
  }
}

export interface RefractionProfileResult {
  /** Normalized signed radial displacement magnitudes in [-1, 1] for x in [0, 1] */
  profile: Float32Array;
  /** Raw Snell's Law maximum displacement in CSS pixels */
  maxDisplacement: number;
}

/**
 * Precomputes the 1D radial refraction displacement profile across the bezel
 * using Snell–Descartes Law (n1 * sin(theta1) = n2 * sin(theta2)) for orthogonal
 * incident rays entering the glass from air (n1 = 1.0).
 *
 * Positive values bend inward toward the flat center (convex magnifying optics).
 * Negative values bend outward away from the center (concave minifying optics).
 */
export function computeRefractionProfile(params: {
  surface: BezelSurfaceType;
  bezelWidth: number;
  glassThickness: number;
  refractiveIndex?: number;
  samples?: number;
}): RefractionProfileResult {
  const {
    surface,
    bezelWidth,
    glassThickness,
    refractiveIndex = 1.5,
    samples = 128,
  } = params;

  const rawDisplacements = new Float32Array(samples);
  const delta = 0.001;
  const n1 = 1.0;
  const n2 = Math.max(1.0, refractiveIndex);
  if (n2 <= n1 + 1e-6) {
    return {
      profile: rawDisplacements,
      maxDisplacement: 0,
    };
  }
  const eta = n1 / n2;

  let maxAbs = 0;

  for (let i = 0; i < samples; i++) {
    // Distance from outer border normalized to [0, 1]
    const x = i / (samples - 1);
    const xMinus = Math.max(0, x - delta);
    const xPlus = Math.min(1, x + delta);
    const h = evaluateSurfaceHeight(surface, x);

    // Physical slope d(y_px) / d(x_px); since bezel height scales with bezelWidth,
    // dy_px/dx_px = (bezelWidth * dh) / (bezelWidth * dx) = dh / dx.
    const dh =
      evaluateSurfaceHeight(surface, xPlus) -
      evaluateSurfaceHeight(surface, xMinus);
    const dx = xPlus - xMinus;
    const slope = dx > 0 ? dh / dx : 0;

    // Cap extreme vertical tangent right at x = 0 to avoid infinite slope singularities
    const clampedSlope = clamp(slope, -12, 12);

    // Outward unit normal in 2D cross-section (x = inward, y = upward into air)
    const invLen = 1 / Math.hypot(clampedSlope, 1);
    const nx = -clampedSlope * invLen;
    const ny = 1 * invLen;

    // Orthogonal incident ray from viewer straight into glass: I = (0, -1)
    // cos(theta1) = -dot(I, N) = ny
    const cosTheta1 = ny;
    const sin2Theta1 = Math.max(0, 1 - cosTheta1 * cosTheta1);
    const k = 1 - eta * eta * sin2Theta1;

    let displacement = 0;
    if (k > 0) {
      // Snell's Law refracted ray direction R = eta * I - (eta * dot(N, I) + sqrt(k)) * N
      // dot(N, I) = -ny
      const factor = -eta * ny + Math.sqrt(k);
      const rx = -factor * nx;
      const ry = -eta - factor * ny;

      if (Math.abs(ry) > 1e-5) {
        // Height above the background plane: glass base thickness + curved bezel elevation
        const elevation = glassThickness + h * bezelWidth;
        // Horizontal shift where the refracted ray meets the background plane (y = 0)
        displacement = (rx / Math.abs(ry)) * elevation;
      }
    }

    // Smoothly taper the extreme outer 1% pixel rim so the 1px border has zero jitter
    const edgeTaper = smoothstep(0, 0.03, x);
    displacement *= edgeTaper;

    rawDisplacements[i] = displacement;
    const absVal = Math.abs(displacement);
    if (absVal > maxAbs) {
      maxAbs = absVal;
    }
  }

  const profile = new Float32Array(samples);
  if (maxAbs > 1e-6) {
    for (let i = 0; i < samples; i++) {
      profile[i] = clamp(rawDisplacements[i] / maxAbs, -1, 1);
    }
  }

  return {
    profile,
    maxDisplacement: maxAbs,
  };
}

/**
 * Signed distance & inward unit normal for a 2D rounded rectangle (pill/capsule/circle)
 * centered at (width/2, height/2) with corner radius `radius`.
 *
 * Returns:
 * - `distFromBorder`: distance inward from the nearest outer boundary (>= 0 inside)
 * - `inX`, `inY`: unit vector pointing INWARD from the nearest boundary toward the interior
 */
export function sampleRoundedRectBezel(
  px: number,
  py: number,
  width: number,
  height: number,
  radius: number
): { distFromBorder: number; inX: number; inY: number } {
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const r = clamp(radius, 0, Math.min(halfW, halfH));

  // Coordinates relative to center
  const cx = px - halfW;
  const cy = py - halfH;

  // Inner box half-extents (before corner rounding)
  const bx = Math.max(0, halfW - r);
  const by = Math.max(0, halfH - r);

  const qx = Math.abs(cx) - bx;
  const qy = Math.abs(cy) - by;

  const signX = cx >= 0 ? 1 : -1;
  const signY = cy >= 0 ? 1 : -1;

  // Rounded-rect SDF (negative inside, 0 on border, positive outside)
  if (qx > 0 && qy > 0) {
    // Corner circular sector
    const cornerDist = Math.hypot(qx, qy);
    const sdf = cornerDist - r;
    const distFromBorder = -sdf;
    // Outward normal points radially away from inner corner center
    const outX = (qx / cornerDist) * signX;
    const outY = (qy / cornerDist) * signY;
    return { distFromBorder, inX: -outX, inY: -outY };
  }

  // Flat straight edge region (top, bottom, left, or right)
  if (qx > qy) {
    const sdf = qx - r;
    return { distFromBorder: -sdf, inX: -signX, inY: 0 };
  }
  const sdf = qy - r;
  return { distFromBorder: -sdf, inX: 0, inY: -signY };
}

/**
 * Samples the 1D normalized refraction profile with linear interpolation.
 */
function sampleProfile(profile: Float32Array, t: number): number {
  const n = profile.length;
  if (n === 0) return 0;
  const clamped = clamp(t, 0, 1);
  const pos = clamped * (n - 1);
  const idx = Math.floor(pos);
  const frac = pos - idx;
  const v0 = profile[idx];
  const v1 = profile[Math.min(n - 1, idx + 1)];
  return v0 + (v1 - v0) * frac;
}

/**
 * Generates the RGBA displacement map pixel buffer for SVG `<feDisplacementMap>`:
 *   R = round(128 + dx * 127)  (X displacement)
 *   G = round(128 + dy * 127)  (Y displacement)
 *   B = 128
 *   A = 255
 *
 * Pixels inside the flat interior (distFromBorder >= effectiveBezel) are encoded
 * as exact neutral gray (128, 128, 128, 255) -> zero optical distortion in center.
 */
export function generateDisplacementPixels(params: {
  width: number;
  height: number;
  radius: number;
  bezelWidth: number;
  profile: Float32Array;
}): Uint8ClampedArray {
  const width = Math.max(2, Math.round(params.width));
  const height = Math.max(2, Math.round(params.height));
  const maxBezel = Math.min(width, height) * 0.5;
  const effectiveBezel = clamp(params.bezelWidth, 2, maxBezel);
  const radius = clamp(params.radius, 0, maxBezel);

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const offset = (y * width + x) * 4;

      const { distFromBorder, inX, inY } = sampleRoundedRectBezel(
        px,
        py,
        width,
        height,
        radius
      );

      if (distFromBorder <= 0 || distFromBorder >= effectiveBezel) {
        data[offset] = 128;
        data[offset + 1] = 128;
        data[offset + 2] = 128;
        data[offset + 3] = 255;
        continue;
      }

      const t = distFromBorder / effectiveBezel;
      const magnitude = sampleProfile(params.profile, t);
      const dx = clamp(inX * magnitude, -1, 1);
      const dy = clamp(inY * magnitude, -1, 1);

      data[offset] = Math.round(128 + dx * 127);
      data[offset + 1] = Math.round(128 + dy * 127);
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
  }

  return data;
}

/**
 * Generates the RGBA directional specular rim highlight map for SVG `<feImage>`:
 * Follows kube.io's directional rim highlight model — brightness peaks along the
 * curved bezel edges aligned with `lightAngleDeg` (upper-left) plus a subtle
 * opposing bounce rim (lower-right), fading cleanly to alpha = 0 in the flat center.
 */
export function generateSpecularPixels(params: {
  width: number;
  height: number;
  radius: number;
  bezelWidth: number;
  lightAngleDeg?: number;
}): Uint8ClampedArray {
  const width = Math.max(2, Math.round(params.width));
  const height = Math.max(2, Math.round(params.height));
  const maxBezel = Math.min(width, height) * 0.5;
  const effectiveBezel = clamp(params.bezelWidth, 2, maxBezel);
  const radius = clamp(params.radius, 0, maxBezel);

  const rad = ((params.lightAngleDeg ?? -60) * Math.PI) / 180;
  const lightX = Math.cos(rad);
  const lightY = Math.sin(rad);

  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const offset = (y * width + x) * 4;

      const { distFromBorder, inX, inY } = sampleRoundedRectBezel(
        px,
        py,
        width,
        height,
        radius
      );

      if (distFromBorder < 0 || distFromBorder >= effectiveBezel) {
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = 0;
        continue;
      }

      // Outward normal points from interior toward outer rim
      const outX = -inX;
      const outY = -inY;

      // Directional highlight alignment with primary light + stronger opposing caustic bounce
      const primaryDot = Math.max(0, outX * lightX + outY * lightY);
      const bounceDot = Math.max(0, -(outX * lightX + outY * lightY));
      const directional =
        0.34 + 0.78 * Math.pow(primaryDot, 1.25) + 0.46 * Math.pow(bounceDot, 1.5);

      // Thick 3D sculpted glass rim meniscus:
      // 1) Crisp outer glass lip (0..3.6px)
      // 2) Broad luminous curved glass shoulder (3..12px) for thick wall presence & chromatic rim refraction
      const t = distFromBorder / effectiveBezel;
      const outerAntiAlias = smoothstep(0, 0.85, distFromBorder);
      const thickOuterLip = Math.exp(-Math.pow(distFromBorder / 3.6, 2));
      const curvedShoulder = Math.pow(1 - t, 1.85) * 0.68;

      const intensity = clamp(
        outerAntiAlias * (thickOuterLip * 0.92 + curvedShoulder) * directional,
        0,
        1
      );

      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(intensity * 255);
    }
  }

  return data;
}

export interface LiquidGlassMapBundle {
  width: number;
  height: number;
  radius: number;
  bezelWidth: number;
  scale: number;
  displacementPixels: Uint8ClampedArray;
  specularPixels: Uint8ClampedArray;
}

/**
 * Convenience builder that computes the full refraction profile, displacement
 * buffer, specular highlight buffer, and SVG feDisplacementMap `scale` for a
 * given element geometry and optical preset.
 */
export function buildLiquidGlassMaps(params: {
  width: number;
  height: number;
  radius: number;
  preset: LiquidGlassOpticalPreset;
}): LiquidGlassMapBundle {
  const width = Math.max(2, Math.round(params.width));
  const height = Math.max(2, Math.round(params.height));
  const maxBezel = Math.min(width, height) * 0.5;
  const effectiveBezel = clamp(params.preset.bezelWidth, 2, maxBezel);
  const radius = clamp(params.radius, 0, maxBezel);

  const { profile, maxDisplacement } = computeRefractionProfile({
    surface: params.preset.surface,
    bezelWidth: effectiveBezel,
    glassThickness: params.preset.glassThickness,
    refractiveIndex: params.preset.refractiveIndex,
  });

  const displacementPixels = generateDisplacementPixels({
    width,
    height,
    radius,
    bezelWidth: effectiveBezel,
    profile,
  });

  const specularPixels = generateSpecularPixels({
    width,
    height,
    radius,
    bezelWidth: effectiveBezel,
    lightAngleDeg: params.preset.lightAngleDeg,
  });

  // Note: feDisplacementMap applies `scale * (R/255 - 0.5)`, so max actual shift is `0.5 * scale`.
  // Allowing up to ~0.82 * minDim delivers a juicy, thick 18–24px optical rim bend without edge wrap.
  const safeMaxScale = Math.min(maxDisplacement, Math.min(width, height) * 0.82);
  const scale = Number(
    (safeMaxScale * params.preset.refractionLevel).toFixed(2)
  );

  return {
    width,
    height,
    radius,
    bezelWidth: effectiveBezel,
    scale,
    displacementPixels,
    specularPixels,
  };
}
