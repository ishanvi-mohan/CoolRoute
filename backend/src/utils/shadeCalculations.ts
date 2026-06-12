import { SunPosition } from '../types/shade.js';
import { getBearing } from './sunPosition.js';

/**
 * Calculate shade score for a route segment based on street orientation
 * This is a heuristic when building height data is unavailable
 *
 * Theory:
 * - N-S streets get more shade in morning/evening (sun is E-W)
 * - E-W streets get more shade at midday (sun is overhead)
 */
export function calculateStreetOrientationShade(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  sunPosition: SunPosition
): number {
  // If sun is below horizon, return max shade
  if (sunPosition.altitude < 0) {
    return 1.0;
  }

  // Get the bearing of the street segment
  const streetBearing = getBearing(startLat, startLng, endLat, endLng);

  // Calculate the angle difference between street and sun
  let angleDiff = Math.abs(streetBearing - sunPosition.azimuth);
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  // Best shade when street is perpendicular to sun (90 degrees)
  // Worst shade when street points at sun (0 degrees)
  const perpendicularFactor = Math.sin((angleDiff * Math.PI) / 180);

  // Factor in sun altitude - lower sun creates longer shadows
  // At altitude 0° (sunrise/sunset): max shade potential
  // At altitude 90° (directly overhead): min shade from buildings
  const altitudeFactor = 1 - sunPosition.altitude / 90;

  // Combine factors (weighted average)
  const shadeScore = perpendicularFactor * 0.6 + altitudeFactor * 0.4;

  return Math.max(0, Math.min(1, shadeScore));
}

/**
 * Calculate shade score with building height data
 * This is more accurate but requires OSM data
 */
export function calculateBuildingShade(
  buildingHeight: number,
  streetWidth: number,
  sunPosition: SunPosition,
  streetBearing: number
): number {
  // If sun is below horizon, return max shade
  if (sunPosition.altitude < 0) {
    return 1.0;
  }

  // Calculate shadow length from building
  const shadowLength =
    buildingHeight / Math.tan((sunPosition.altitude * Math.PI) / 180);

  // Check if shadow covers the street
  let angleDiff = Math.abs(streetBearing - sunPosition.azimuth);
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  // Shadow is cast perpendicular to sun direction
  const effectiveShadowWidth = shadowLength * Math.sin((angleDiff * Math.PI) / 180);

  // Calculate coverage percentage
  const coverage = Math.min(1, effectiveShadowWidth / streetWidth);

  return coverage;
}

/**
 * Time-of-day shade bonus
 * Early morning and late afternoon have better shade potential
 */
export function getTimeOfDayBonus(hour: number): number {
  // 6-9 AM: good shade (0.2 bonus)
  if (hour >= 6 && hour < 9) {
    return 0.2;
  }
  // 9-11 AM and 4-6 PM: moderate shade (0.1 bonus)
  if ((hour >= 9 && hour < 11) || (hour >= 16 && hour < 18)) {
    return 0.1;
  }
  // 11 AM - 4 PM: worst shade (no bonus, sun is high)
  if (hour >= 11 && hour < 16) {
    return 0;
  }
  // Evening/night: max shade
  if (hour >= 18 || hour < 6) {
    return 0.3;
  }
  return 0;
}
