import type { SunPosition } from '../types/shade.js';
import type { OsmBuilding }  from '../types/building.js';
import { getBearing, haversineDistance } from './sunPosition.js';

// ─── Point-offset helper ─────────────────────────────────────────────────────

/**
 * Move a lat/lng point `distanceM` metres in direction `bearingDeg`.
 */
function offsetPoint(
  lat: number, lng: number,
  bearingDeg: number, distanceM: number
): { lat: number; lng: number } {
  const R = 6371000;
  const b = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceM * Math.cos(b) / R) * (180 / Math.PI);
  const dLng = (distanceM * Math.sin(b) / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

// ─── Building shadow coverage for a single point ─────────────────────────────

/**
 * Calculate shade coverage (0–1) for a point using real OSM buildings.
 *
 * A building at distance D shades the point when:
 *   1. It lies within ±80° of the sun direction (i.e. is between point and sun).
 *   2. Its shadow length (height / tan(altitude)) ≥ D.
 *
 * Returns the best coverage found across all qualifying buildings.
 */
export function shadeCoverageAt(
  lat: number, lng: number,
  buildings: OsmBuilding[],
  sunPosition: SunPosition
): number {
  if (sunPosition.altitude <= 0) return 1.0;
  if (sunPosition.altitude <= 5) return 0.95;

  const sunAltRad = sunPosition.altitude * Math.PI / 180;
  let best = 0;

  for (const b of buildings) {
    const dist = haversineDistance(lat, lng, b.centroid.lat, b.centroid.lng);
    if (dist < 2 || dist > 150) continue;

    const bearingToBuilding = getBearing(lat, lng, b.centroid.lat, b.centroid.lng);
    let angleDiff = Math.abs(bearingToBuilding - sunPosition.azimuth);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    if (angleDiff > 80) continue; // building not toward the sun

    const shadowLength = b.height / Math.tan(sunAltRad);
    if (shadowLength < dist) continue; // shadow doesn't reach here

    const alignmentFactor = Math.cos((angleDiff * Math.PI) / 180);
    const depthFactor = Math.min(1, (shadowLength - dist) / Math.max(dist, 10));
    const coverage = Math.min(1, alignmentFactor * 0.6 + depthFactor * 0.4);
    if (coverage > best) best = coverage;
  }

  return best;
}

// ─── Building-based shade for a route segment ───────────────────────────────

/**
 * Shade score for a route segment — uses the segment midpoint.
 */
export function calculateBuildingShadeCoverage(
  segStartLat: number, segStartLng: number,
  segEndLat:   number, segEndLng:   number,
  buildings:   OsmBuilding[],
  sunPosition: SunPosition
): number {
  const midLat = (segStartLat + segEndLat) / 2;
  const midLng = (segStartLng + segEndLng) / 2;
  return shadeCoverageAt(midLat, midLng, buildings, sunPosition);
}

// ─── Which side of the street is shadier ─────────────────────────────────────

/**
 * When building data is available: probe both sidewalks (7 m either side
 * of the road centre) and compare the shade coverage at each probe point.
 *
 * This directly answers "which sidewalk is in shadow right now" instead of
 * reasoning abstractly about sun angles — much more reliable in a dense city
 * like HK where buildings on BOTH sides can cast shadows.
 *
 * Falls back to the sun-azimuth heuristic when no building data is available.
 */
export function getShadedSide(
  segStartLat: number, segStartLng: number,
  segEndLat:   number, segEndLng:   number,
  bearing:     number,
  buildings:   OsmBuilding[],
  sunPosition: SunPosition
): 'left' | 'right' | 'either' {
  if (sunPosition.altitude <= 5) return 'either';

  const midLat = (segStartLat + segEndLat) / 2;
  const midLng = (segStartLng + segEndLng) / 2;

  if (buildings.length > 0) {
    // Probe at 4 m, 8 m, and 14 m on each side to cover narrow alleys,
    // standard streets, and wide boulevards without committing to one width.
    const PROBES = [4, 8, 14];
    let leftShade  = 0;
    let rightShade = 0;
    for (const d of PROBES) {
      const lp = offsetPoint(midLat, midLng, (bearing - 90 + 360) % 360, d);
      const rp = offsetPoint(midLat, midLng, (bearing + 90) % 360,        d);
      leftShade  = Math.max(leftShade,  shadeCoverageAt(lp.lat, lp.lng, buildings, sunPosition));
      rightShade = Math.max(rightShade, shadeCoverageAt(rp.lat, rp.lng, buildings, sunPosition));
    }

    const THRESHOLD = 0.12; // require meaningful difference before picking a side
    if (leftShade  > rightShade + THRESHOLD) return 'left';
    if (rightShade > leftShade  + THRESHOLD) return 'right';
    return 'either';
  }

  // ── Fallback: pure sun-azimuth heuristic ─────────────────────────────────
  // Walk on the side the sun is coming from: the buildings on that side sit
  // between you and the sun and shade their own (near) sidewalk first. The
  // far sidewalk is only shaded if those buildings are tall enough to throw a
  // shadow clear across the street — the less reliable case.
  //   Sun on your right → right sidewalk is shaded → walk right.
  //   Sun on your left  → left  sidewalk is shaded → walk left.
  const sunRelative = ((sunPosition.azimuth - bearing) + 360) % 360;
  if (sunRelative <= 20 || sunRelative >= 340) return 'either'; // sun ahead/behind
  if (sunRelative >= 160 && sunRelative <= 200) return 'either';
  return sunRelative < 180 ? 'right' : 'left';
}

// ─── Orientation heuristic (fallback for overall shade score) ────────────────

export function calculateStreetOrientationShade(
  startLat: number, startLng: number,
  endLat:   number, endLng:   number,
  sunPosition: SunPosition
): number {
  if (sunPosition.altitude < 0) return 1.0;

  const streetBearing = getBearing(startLat, startLng, endLat, endLng);
  let angleDiff = Math.abs(streetBearing - sunPosition.azimuth);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;

  const perpendicularFactor = Math.sin((angleDiff * Math.PI) / 180);
  const altitudeFactor = 1 - sunPosition.altitude / 90;

  return Math.max(0, Math.min(1, perpendicularFactor * 0.6 + altitudeFactor * 0.4));
}

// ─── Time-of-day bonus ───────────────────────────────────────────────────────

export function getTimeOfDayBonus(hour: number): number {
  if (hour >= 6  && hour < 9)  return 0.2;
  if (hour >= 9  && hour < 11) return 0.1;
  if (hour >= 16 && hour < 18) return 0.1;
  if (hour >= 18 || hour < 6)  return 0.3;
  return 0;
}
