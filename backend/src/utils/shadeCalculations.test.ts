import { test } from 'node:test';
import assert from 'node:assert/strict';
import SunCalc from 'suncalc';

import type { OsmBuilding } from '../types/building.js';
import { calculateSunPosition } from './sunPosition.js';
import { getShadedSide } from './shadeCalculations.js';

// Move a point `metres` east (+) / west (−) of (lat,lng). East-only offset,
// mirrors the offsetPoint math used inside shadeCalculations for a 90° bearing.
function eastOf(lat: number, lng: number, metres: number) {
  const R = 6371000;
  const dLng = (metres / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat, lng: lng + dLng };
}

// Hong Kong, roughly Central.
const HK_LAT = 22.2819;
const HK_LNG = 114.1582;

// Helper: build a SunPosition with an explicit compass azimuth (0=N,90=E,180=S,270=W).
function sun(altitude: number, azimuth: number) {
  return { altitude, azimuth };
}

// A short north-bound segment (bearing ≈ 0). No building data → fallback path.
function northSegment() {
  return {
    startLat: HK_LAT,
    startLng: HK_LNG,
    endLat: HK_LAT + 0.0005, // ~55 m due north
    endLng: HK_LNG,
    bearing: 0,
  };
}

test('azimuth convention: morning sun in the east, evening sun in the west', () => {
  // NB: do NOT test "noon sun is due south" in HK. Near the summer solstice the
  // sun's declination (~+23°) exceeds HK's latitude (22.3°N), so at solar noon
  // the sun is nearly overhead (alt ~89°) and slightly to the NORTH — and the
  // azimuth is numerically degenerate near the zenith. Use morning/evening
  // instead, where the azimuth is well-defined.
  const morning = calculateSunPosition(HK_LAT, HK_LNG, new Date('2026-06-13T22:30:00Z')); // HK 06:30
  assert.ok(morning.altitude > 0, 'sun should be up at 06:30');
  assert.ok(
    morning.azimuth > 45 && morning.azimuth < 135,
    `morning sun should be in the east (45–135°), got ${morning.azimuth.toFixed(1)}°`,
  );

  const evening = calculateSunPosition(HK_LAT, HK_LNG, new Date('2026-06-14T10:00:00Z')); // HK 18:00
  assert.ok(evening.altitude > 0, 'sun should be up at 18:00');
  assert.ok(
    evening.azimuth > 225 && evening.azimuth < 315,
    `evening sun should be in the west (225–315°), got ${evening.azimuth.toFixed(1)}°`,
  );
});

test('azimuth convention matches the SunCalc + 180 conversion', () => {
  const t = new Date(Date.UTC(2026, 5, 13, 2, 0, 0));
  const ours = calculateSunPosition(HK_LAT, HK_LNG, t);
  const raw = SunCalc.getPosition(t, HK_LAT, HK_LNG);
  const expected = (((raw.azimuth * 180) / Math.PI) + 180 + 360) % 360;
  assert.ok(Math.abs(ours.azimuth - expected) < 1e-6);
});

test('walk on the side the sun is coming from — sun on the right → walk right', () => {
  const seg = northSegment();
  // Heading north, sun due east (azimuth 90) → sun is on the walker's right.
  const side = getShadedSide(
    seg.startLat, seg.startLng,
    seg.endLat, seg.endLng,
    seg.bearing,
    [], // no buildings → exercise the fallback heuristic
    sun(30, 90),
  );
  assert.equal(side, 'right');
});

test('sun on the left → walk left', () => {
  const seg = northSegment();
  // Heading north, sun due west (azimuth 270) → sun is on the walker's left.
  const side = getShadedSide(
    seg.startLat, seg.startLng,
    seg.endLat, seg.endLng,
    seg.bearing,
    [],
    sun(30, 270),
  );
  assert.equal(side, 'left');
});

test('sun roughly ahead or behind → no side preference', () => {
  const seg = northSegment();
  const ahead = getShadedSide(seg.startLat, seg.startLng, seg.endLat, seg.endLng, seg.bearing, [], sun(30, 5));
  const behind = getShadedSide(seg.startLat, seg.startLng, seg.endLat, seg.endLng, seg.bearing, [], sun(30, 185));
  assert.equal(ahead, 'either');
  assert.equal(behind, 'either');
});

test('low sun (altitude ≤ 5°) → either, optimisation effectively off', () => {
  const seg = northSegment();
  const side = getShadedSide(seg.startLat, seg.startLng, seg.endLat, seg.endLng, seg.bearing, [], sun(3, 90));
  assert.equal(side, 'either');
});

// ── Probe-based path (real building data) ────────────────────────────────────
// Heading north (bearing 0); right = east, left = west. Sun in the east at 30°.
// A 12 m building sits 18 m to the EAST of the road. Its shadow (~21 m long)
// reaches the east/right sidewalk probes but not the west/left ones, so the
// shaded side should be the building's side: right.

const segMidLat = HK_LAT + 0.00025; // midpoint of the north segment
const segMidLng = HK_LNG;

function buildingAt(lat: number, lng: number, height: number): OsmBuilding {
  return { id: 1, height, centroid: { lat, lng } };
}

test('probe path: building on the east → walk the east (right) side', () => {
  const seg = northSegment();
  const east = eastOf(segMidLat, segMidLng, 18);
  const buildings = [buildingAt(east.lat, east.lng, 12)];
  const side = getShadedSide(
    seg.startLat, seg.startLng,
    seg.endLat, seg.endLng,
    seg.bearing,
    buildings,
    sun(30, 90), // sun due east
  );
  assert.equal(side, 'right');
});

test('probe path: building on the west → walk the west (left) side', () => {
  const seg = northSegment();
  const west = eastOf(segMidLat, segMidLng, -18); // 18 m west
  const buildings = [buildingAt(west.lat, west.lng, 12)];
  const side = getShadedSide(
    seg.startLat, seg.startLng,
    seg.endLat, seg.endLng,
    seg.bearing,
    buildings,
    sun(30, 270), // sun due west, so the west building shades the west sidewalk
  );
  assert.equal(side, 'left');
});

test('probe path: building too short to shade either sidewalk → either', () => {
  const seg = northSegment();
  const east = eastOf(segMidLat, segMidLng, 18);
  const buildings = [buildingAt(east.lat, east.lng, 1)]; // ~1.7 m shadow, reaches nothing
  const side = getShadedSide(
    seg.startLat, seg.startLng,
    seg.endLat, seg.endLng,
    seg.bearing,
    buildings,
    sun(30, 90),
  );
  assert.equal(side, 'either');
});
