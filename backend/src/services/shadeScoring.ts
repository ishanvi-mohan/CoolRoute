import { RouteRequest, Route, RouteComparison, RouteSegment } from '../types/route.js';
import { calculateSunPosition, isNighttime } from '../utils/sunPosition.js';
import {
  calculateStreetOrientationShade,
  getTimeOfDayBonus,
} from '../utils/shadeCalculations.js';
import { getUVIndex } from './weather.js';
import { getWalkingRoutes, MapboxRoute } from './mapbox.js';

const AVERAGE_WALKING_SPEED = 5; // km/h
const MAX_DETOUR_PERCENTAGE = 0.2; // 20% max detour constraint

interface ScoredRoute {
  route: MapboxRoute;
  segments: RouteSegment[];
  totalDistance: number;
  shadeCoverage: number;
  avgShadeScore: number;
}

function buildRouteObject(scored: ScoredRoute, shortestDistance: number, uvIndex: number): Route {
  const detourDistance = scored.totalDistance - shortestDistance;
  const estimatedTime = (scored.totalDistance / 1000 / AVERAGE_WALKING_SPEED) * 60;
  return {
    segments: scored.segments,
    totalDistance: scored.totalDistance,
    estimatedTime,
    shadeCoverage: scored.shadeCoverage,
    detourDistance: Math.max(0, Math.round(detourDistance)),
    uvIndex,
  };
}

export async function calculateShadeOptimizedRoute(
  request: RouteRequest
): Promise<RouteComparison> {
  const { start, destination, timestamp } = request;

  const nighttime = isNighttime(start.lat, start.lng, timestamp);
  const uvIndex = await getUVIndex(start.lat, start.lng);
  const skipOptimization = nighttime || uvIndex < 3;

  if (skipOptimization) {
    console.log('Nighttime or low UV - shade optimization skipped');
  }

  const mapboxRoutes = await getWalkingRoutes(
    start.lng,
    start.lat,
    destination.lng,
    destination.lat
  );

  if (mapboxRoutes.length === 0) {
    throw new Error('No routes found');
  }

  const sunPosition = calculateSunPosition(start.lat, start.lng, timestamp);
  const timeBonus = getTimeOfDayBonus(timestamp.getHours());

  const scoredRoutes: ScoredRoute[] = mapboxRoutes.map((route) =>
    scoreRouteForShade(route, sunPosition, timeBonus)
  );

  // Shortest route = minimum distance
  const shortestScored = scoredRoutes.reduce((min, r) =>
    r.totalDistance < min.totalDistance ? r : min
  );
  const shortestDistance = shortestScored.totalDistance;
  const maxAllowedDistance = shortestDistance * (1 + MAX_DETOUR_PERCENTAGE);

  // Best shaded route = highest shade score within 20% constraint
  let shadedScored: ScoredRoute;
  if (skipOptimization) {
    shadedScored = shortestScored;
  } else {
    // Sort by shade score descending, pick first that fits constraint
    const byShade = [...scoredRoutes].sort((a, b) => b.avgShadeScore - a.avgShadeScore);
    const withinConstraint = byShade.find((r) => r.totalDistance <= maxAllowedDistance);
    shadedScored = withinConstraint ?? shortestScored;
  }

  const isSameRoute = shadedScored === shortestScored ||
    Math.abs(shadedScored.totalDistance - shortestScored.totalDistance) < 1;

  return {
    shadedRoute: buildRouteObject(shadedScored, shortestDistance, uvIndex),
    shortestRoute: buildRouteObject(shortestScored, shortestDistance, uvIndex),
    isSameRoute,
  };
}

function scoreRouteForShade(
  route: MapboxRoute,
  sunPosition: { altitude: number; azimuth: number },
  timeBonus: number
): ScoredRoute {
  const segments: RouteSegment[] = [];
  let totalShadeScore = 0;

  const steps = route.legs[0]?.steps || [];

  for (const step of steps) {
    if (step.geometry.coordinates.length < 2) continue;

    const coords = step.geometry.coordinates;
    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    const baseShadeScore = calculateStreetOrientationShade(
      startCoord[1],
      startCoord[0],
      endCoord[1],
      endCoord[0],
      sunPosition
    );

    const shadeScore = Math.min(1, baseShadeScore + timeBonus);
    totalShadeScore += shadeScore * step.distance;

    segments.push({
      start: { lat: startCoord[1], lng: startCoord[0] },
      end: { lat: endCoord[1], lng: endCoord[0] },
      distance: step.distance,
      shadeScore,
    });
  }

  if (segments.length === 0) {
    const coords = route.geometry.coordinates;
    const startCoord = coords[0];
    const endCoord = coords[coords.length - 1];

    const shadeScore = calculateStreetOrientationShade(
      startCoord[1],
      startCoord[0],
      endCoord[1],
      endCoord[0],
      sunPosition
    );

    segments.push({
      start: { lat: startCoord[1], lng: startCoord[0] },
      end: { lat: endCoord[1], lng: endCoord[0] },
      distance: route.distance,
      shadeScore: Math.min(1, shadeScore + timeBonus),
    });

    totalShadeScore = shadeScore * route.distance;
  }

  const avgShadeScore = totalShadeScore / route.distance;
  const shadeCoverage = Math.round(avgShadeScore * 100);

  return {
    route,
    segments,
    totalDistance: route.distance,
    shadeCoverage,
    avgShadeScore,
  };
}
