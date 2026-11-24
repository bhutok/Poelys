import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIQUID_GLASS_PRESETS,
  buildLiquidGlassMaps,
  computeRefractionProfile,
  evaluateSurfaceHeight,
  generateDisplacementPixels,
  generateSpecularPixels,
} from './refraction';

test('convex-squircle surface height matches kube.io formula at endpoints and rises monotonically', () => {
  assert.equal(evaluateSurfaceHeight('convex-squircle', 0), 0);
  assert.equal(evaluateSurfaceHeight('convex-squircle', 1), 1);

  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const val = evaluateSurfaceHeight('convex-squircle', i / 20);
    assert.ok(val >= prev, `expected monotonic increase at step ${i}`);
    prev = val;
  }

  // Squircle rises steeper near 0 than a circular arc
  const squircleQuarter = evaluateSurfaceHeight('convex-squircle', 0.25);
  const circleQuarter = evaluateSurfaceHeight('convex-circle', 0.25);
  assert.ok(squircleQuarter > circleQuarter);
});

test('Snell Law refraction profile produces zero displacement for air (n=1) and positive inward bending for glass (n=1.5)', () => {
  const air = computeRefractionProfile({
    surface: 'convex-squircle',
    bezelWidth: 16,
    glassThickness: 42,
    refractiveIndex: 1.0,
  });
  assert.equal(air.maxDisplacement, 0);
  assert.equal(air.profile[10], 0);

  const glass = computeRefractionProfile({
    surface: 'convex-squircle',
    bezelWidth: 16,
    glassThickness: 42,
    refractiveIndex: 1.5,
  });
  assert.ok(glass.maxDisplacement > 5, 'expected positive refraction magnitude');
  // Outer bezel bends inward (positive), flat center approaches zero
  assert.ok(glass.profile[12] > 0.2);
  assert.ok(Math.abs(glass.profile[glass.profile.length - 1]) < 0.05);
});

test('2D displacement map encodes neutral (128, 128) in flat center and symmetric inward vectors on opposite bezels', () => {
  const width = 120;
  const height = 52;
  const bezelWidth = 14;
  const { profile } = computeRefractionProfile({
    surface: 'convex-squircle',
    bezelWidth,
    glassThickness: 42,
    refractiveIndex: 1.5,
  });

  const pixels = generateDisplacementPixels({
    width,
    height,
    radius: height / 2,
    bezelWidth,
    profile,
  });

  assert.equal(pixels.length, width * height * 4);

  const pixelAt = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return {
      r: pixels[idx],
      g: pixels[idx + 1],
      b: pixels[idx + 2],
      a: pixels[idx + 3],
    };
  };

  // Flat center pixel -> exact neutral (128, 128, 128, 255)
  const center = pixelAt(60, 26);
  assert.deepEqual(center, { r: 128, g: 128, b: 128, a: 255 });

  // Top bezel bends downward (+Y -> G > 128), bottom bezel bends upward (-Y -> G < 128)
  const topBezel = pixelAt(60, 3);
  const bottomBezel = pixelAt(60, height - 4);
  assert.equal(topBezel.r, 128);
  assert.ok(topBezel.g > 140, `expected top G > 140, got ${topBezel.g}`);
  assert.equal(bottomBezel.r, 128);
  assert.ok(bottomBezel.g < 116, `expected bottom G < 116, got ${bottomBezel.g}`);
  assert.equal(topBezel.g + bottomBezel.g, 256);

  // Left bezel bends rightward (+X -> R > 128), right bezel bends leftward (-X -> R < 128)
  const leftBezel = pixelAt(3, 26);
  const rightBezel = pixelAt(width - 4, 26);
  assert.ok(leftBezel.r > 140, `expected left R > 140, got ${leftBezel.r}`);
  assert.ok(rightBezel.r < 116, `expected right R < 116, got ${rightBezel.r}`);
  assert.equal(leftBezel.r + rightBezel.r, 256);
});

test('specular rim highlight map is transparent in flat center and brighter on upper-left lit bezel', () => {
  const width = 100;
  const height = 52;
  const pixels = generateSpecularPixels({
    width,
    height,
    radius: 26,
    bezelWidth: 14,
    lightAngleDeg: -60,
  });

  const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];

  // Center is completely transparent
  assert.equal(alphaAt(50, 26), 0);

  // Top rim (aligned with -60 deg light) has crisp visible specular alpha
  // and thicker glass shoulder (4px inward) remains clearly luminous
  const topRimAlpha = alphaAt(50, 1);
  const shoulderAlpha = alphaAt(50, 4);
  assert.ok(topRimAlpha > 140, `expected bright top rim, got ${topRimAlpha}`);
  assert.ok(shoulderAlpha > 75, `expected thick luminous glass shoulder at 4px, got ${shoulderAlpha}`);
});

test('buildLiquidGlassMaps produces valid non-zero SVG scales for pill, orb, and droplet presets', () => {
  const pill = buildLiquidGlassMaps({
    width: 336,
    height: 62,
    radius: 31,
    preset: LIQUID_GLASS_PRESETS.pill,
  });
  const orb = buildLiquidGlassMaps({
    width: 54,
    height: 54,
    radius: 27,
    preset: LIQUID_GLASS_PRESETS.orb,
  });
  const droplet = buildLiquidGlassMaps({
    width: 90,
    height: 68,
    radius: 34,
    preset: LIQUID_GLASS_PRESETS.droplet,
  });

  assert.ok(pill.scale >= 25 && pill.scale <= 68, `unexpected pill scale ${pill.scale}`);
  assert.ok(orb.scale >= 25 && orb.scale <= 64, `unexpected orb scale ${orb.scale}`);
  assert.ok(droplet.scale >= 30 && droplet.scale <= 80, `unexpected droplet scale ${droplet.scale}`);
});
