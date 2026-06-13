import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

import { calculateSunPosition } from '../utils/sunPosition.js';
import type { GoogleRoute } from './googleMaps.js';

// Fixed inputs so the run is deterministic.
const START = { lat: 22.2849, lng: 114.1577 };
const DEST = { lat: 22.2783, lng: 114.1747 };
const TS = new Date('2026-06-14T01:00:00Z'); // HK 09:00 — sun well up in the east

// Sun azimuth for these inputs; used to orient routes for known shade scores.
const SUN_AZ = calculateSunPosition(START.lat, START.lng, TS).azimuth;

/** End point `metres` from a start along `bearingDeg`. */
function offset(lat: number, lng: number, bearingDeg: number, metres: number) {
  const R = 6371000;
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = ((metres * Math.cos(b)) / R) * (180 / Math.PI);
  const dLng = ((metres * Math.sin(b)) / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * One-step route. `bearingDeg` controls its orientation-shade:
 *  - perpendicular to the sun (SUN_AZ + 90) → high shade
 *  - parallel to the sun     (SUN_AZ)        → low shade
 * `distance` is the nominal route length the selector reasons about.
 */
function route(distance: number, bearingDeg: number): GoogleRoute {
  const end = offset(START.lat, START.lng, bearingDeg, distance);
  return {
    distance,
    duration: distance, // unused by selection
    polyline: [START, end],
    steps: [
      {
        distance,
        duration: distance,
        startLat: START.lat,
        startLng: START.lng,
        endLat: end.lat,
        endLng: end.lng,
      },
    ],
  };
}

const PERP = (SUN_AZ + 90) % 360; // shadiest orientation
const PARA = SUN_AZ % 360; // sunniest orientation

let routesToReturn: GoogleRoute[] = [];

// Replace the three network-bound modules with deterministic stubs.
before(async () => {
  const here = import.meta.url;
  mock.module(new URL('./googleMaps.js', here).href, {
    namedExports: { getWalkingRoutes: async () => routesToReturn },
  });
  mock.module(new URL('./weather.js', here).href, {
    namedExports: { getUVIndex: async () => 8 }, // > 3, so optimisation is NOT skipped
  });
  mock.module(new URL('./overpass.js', here).href, {
    namedExports: { fetchBuildingsNearRoute: async () => [] }, // force orientation heuristic
  });
});

async function run() {
  const { calculateShadeOptimizedRoute } = await import('./shadeScoring.js');
  return calculateShadeOptimizedRoute({ start: START, destination: DEST, timestamp: TS });
}

test('picks the shadiest route that is within the 20% detour limit', async () => {
  routesToReturn = [
    route(1000, PARA), // shortest, sunny
    route(1150, PERP), // +15% → within limit, shady
    route(1300, PERP), // +30% → over limit, shady but ineligible
  ];
  const r = await run();

  assert.equal(Math.round(r.shortestRoute.totalDistance), 1000, 'shortest = 1000 m');
  assert.equal(Math.round(r.shadedRoute.totalDistance), 1150, 'shaded = 1150 m (the +15% route)');
  assert.notEqual(Math.round(r.shadedRoute.totalDistance), 1300, 'must NOT pick the +30% route');
  assert.ok(
    r.shadedRoute.totalDistance <= r.shortestRoute.totalDistance * 1.2 + 1e-6,
    '20% detour constraint holds',
  );
  assert.equal(r.shadedRoute.detourDistance, 150);
  assert.equal(r.isSameRoute, false);
  assert.ok(
    r.shadedRoute.shadeCoverage > r.shortestRoute.shadeCoverage,
    'chosen route is genuinely shadier than the shortest',
  );
});

test('falls back to the shortest route when every shadier option exceeds 20%', async () => {
  routesToReturn = [
    route(1000, PARA), // shortest, sunny
    route(1300, PERP), // shady but +30% → ineligible
  ];
  const r = await run();

  assert.equal(Math.round(r.shadedRoute.totalDistance), 1000, 'falls back to shortest');
  assert.equal(r.shadedRoute.detourDistance, 0);
  assert.equal(r.isSameRoute, true);
});

test('when shortest is already shadiest, shaded == shortest', async () => {
  routesToReturn = [
    route(1000, PERP), // shortest AND shadiest
    route(1100, PARA), // longer and sunnier
  ];
  const r = await run();

  assert.equal(Math.round(r.shadedRoute.totalDistance), 1000);
  assert.equal(r.isSameRoute, true);
});
