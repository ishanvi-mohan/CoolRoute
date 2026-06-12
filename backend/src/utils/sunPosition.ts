import SunCalc from 'suncalc';
import { SunPosition } from '../types/shade.js';

/**
 * Calculate sun position (altitude and azimuth) for given location and time
 * Uses SunCalc library for accurate solar position calculations
 */
export function calculateSunPosition(
  lat: number,
  lng: number,
  timestamp: Date
): SunPosition {
  const sunPosition = SunCalc.getPosition(timestamp, lat, lng);

  // Convert radians to degrees
  const altitude = (sunPosition.altitude * 180) / Math.PI;
  const azimuth = ((sunPosition.azimuth * 180) / Math.PI + 180) % 360; // Normalize to 0-360

  return {
    altitude,
    azimuth,
  };
}

/**
 * Check if it's nighttime (sun below horizon)
 */
export function isNighttime(lat: number, lng: number, timestamp: Date): boolean {
  const position = calculateSunPosition(lat, lng, timestamp);
  return position.altitude < 0;
}

/**
 * Get the bearing (direction) between two points
 * Returns azimuth in degrees (0-360)
 */
export function getBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}
