import { RouteRequest, Route, RouteComparison, RouteSegment } from '../types/route.js';
import type { OsmBuilding } from '../types/building.js';
import { calculateSunPosition, isNighttime } from '../utils/sunPosition.js';
import {
  calculateBuildingShadeCoverage,
  calculateStreetOrientationShade,
  getTimeOfDayBonus,
  getShadedSide,
} from '../utils/shadeCalculations.js';
import { getUVIndex } from './weather.js';
import { getWalkingRoutes, GoogleRoute } from './googleMaps.js';
import { fetchBuildingsNearRoute } from './overpass.js';
import { getBearing } from '../utils/sunPosition.js';

const AVERAGE_WALKING_SPEED  = 5;   // km/h
const MAX_DETOUR_PERCENTAGE  = 0.2; // 20%

interface ScoredRoute {
  route: GoogleRoute;
  segments: RouteSegment[];
  totalDistance: number;
  shadeCoverage: number;
  avgShadeScore: number;
}

function buildRouteObject(
  scored: ScoredRoute,
  shortestDistance: number,
  uvIndex: number
): Route {
  const detourDistance = scored.totalDistance - shortestDistance;
  const estimatedTime  = (scored.totalDistance / 1000 / AVERAGE_WALKING_SPEED) * 60;
  return {
    segments:      scored.segments,
    polyline:      scored.route.polyline,
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

  const nighttime       = isNighttime(start.lat, start.lng, timestamp);
  const uvIndex         = await getUVIndex(start.lat, start.lng);
  const skipOptimization = nighttime || uvIndex < 3;

  if (skipOptimization) {
    console.log('Nighttime or low UV — using shortest route without shade optimisation');
  }

  const googleRoutes = await getWalkingRoutes(
    start.lng, start.lat,
    destination.lng, destination.lat
  );

  if (googleRoutes.length === 0) throw new Error('No routes found');

  const sunPosition = calculateSunPosition(start.lat, start.lng, timestamp);
  const timeBonus   = getTimeOfDayBonus(timestamp.getHours());

  // ── Fetch buildings once for all routes ────────────────────────────────
  // Collect all segments across every candidate route for a single Overpass call.
  // Fall back to orientation heuristic if Overpass fails (fetchBuildingsNearRoute
  // never throws — it returns [] on error).
  // Only endpoints are needed to compute the Overpass bounding box, so this is
  // intentionally a narrower shape than RouteSegment (no bearing/shadedSide).
  const allSegments: Pick<RouteSegment, 'start' | 'end'>[] = googleRoutes.flatMap((r) =>
    r.steps.map((s) => ({
      start: { lat: s.startLat, lng: s.startLng },
      end:   { lat: s.endLat,   lng: s.endLng   },
    }))
  );

  let buildings: OsmBuilding[] = [];
  if (!skipOptimization) {
    buildings = await fetchBuildingsNearRoute(allSegments);
  }

  const useBuildingData = buildings.length > 0;
  console.log(
    useBuildingData
      ? `Using building shadows (${buildings.length} buildings)`
      : 'No building data — using orientation heuristic'
  );

  // ── Score each candidate route ──────────────────────────────────────────
  const scoredRoutes: ScoredRoute[] = googleRoutes.map((route) =>
    scoreRouteForShade(route, sunPosition, timeBonus, buildings, useBuildingData)
  );

  // Shortest route by distance
  const shortestScored = scoredRoutes.reduce((min, r) =>
    r.totalDistance < min.totalDistance ? r : min
  );
  const shortestDistance   = shortestScored.totalDistance;
  const maxAllowedDistance = shortestDistance * (1 + MAX_DETOUR_PERCENTAGE);

  // Best shaded route within 20% detour constraint
  let shadedScored: ScoredRoute;
  if (skipOptimization) {
    shadedScored = shortestScored;
  } else {
    const byShade = [...scoredRoutes].sort((a, b) => b.avgShadeScore - a.avgShadeScore);
    shadedScored  = byShade.find((r) => r.totalDistance <= maxAllowedDistance) ?? shortestScored;
  }

  const isSameRoute =
    shadedScored === shortestScored ||
    Math.abs(shadedScored.totalDistance - shortestScored.totalDistance) < 1;

  return {
    shadedRoute:   buildRouteObject(shadedScored,  shortestDistance, uvIndex),
    shortestRoute: buildRouteObject(shortestScored, shortestDistance, uvIndex),
    isSameRoute,
  };
}

function scoreRouteForShade(
  route:            GoogleRoute,
  sunPosition:      { altitude: number; azimuth: number },
  timeBonus:        number,
  buildings:        OsmBuilding[],
  useBuildingData:  boolean
): ScoredRoute {
  const segments: RouteSegment[] = [];
  let totalShadeScore = 0;

  for (const step of route.steps) {
    let baseShadeScore: number;

    if (useBuildingData) {
      baseShadeScore = calculateBuildingShadeCoverage(
        step.startLat, step.startLng,
        step.endLat,   step.endLng,
        buildings,
        sunPosition
      );
    } else {
      baseShadeScore = calculateStreetOrientationShade(
        step.startLat, step.startLng,
        step.endLat,   step.endLng,
        sunPosition
      );
    }

    const shadeScore = Math.min(1, baseShadeScore + timeBonus);
    totalShadeScore += shadeScore * step.distance;

    const bearing    = getBearing(step.startLat, step.startLng, step.endLat, step.endLng);
    const shadedSide = getShadedSide(
      step.startLat, step.startLng,
      step.endLat,   step.endLng,
      bearing, buildings, sunPosition
    );

    segments.push({
      start: { lat: step.startLat, lng: step.startLng },
      end:   { lat: step.endLat,   lng: step.endLng   },
      distance: step.distance,
      shadeScore,
      bearing,
      shadedSide,
    });
  }

  if (segments.length === 0) {
    const fallback = 0.5;
    segments.push({
      start: { lat: route.steps[0]?.startLat ?? 0, lng: route.steps[0]?.startLng ?? 0 },
      end:   { lat: route.steps[0]?.endLat   ?? 0, lng: route.steps[0]?.endLng   ?? 0 },
      distance: route.distance,
      shadeScore: fallback,
      bearing: 0,
      shadedSide: 'either',
    });
    totalShadeScore = fallback * route.distance;
  }

  const avgShadeScore = route.distance > 0 ? totalShadeScore / route.distance : 0;

  return {
    route,
    segments,
    totalDistance: route.distance,
    shadeCoverage: Math.round(avgShadeScore * 100),
    avgShadeScore,
  };
}
