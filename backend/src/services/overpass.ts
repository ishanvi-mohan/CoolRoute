import https from 'node:https';
import dns   from 'node:dns';
import axios from 'axios';
import type { RouteSegment } from '../types/route.js';
import type { OsmBuilding }  from '../types/building.js';

/** Minimal shape needed to compute a bounding box — just segment endpoints. */
type SegmentBounds = Pick<RouteSegment, 'start' | 'end'>;

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Same IPv4-only agent as googleMaps.ts
const httpsAgent = new https.Agent({
  keepAlive: false,
  lookup: (hostname, opts, cb) =>
    dns.lookup(hostname, { ...opts, family: 4 }, cb),
});

/**
 * Fetch all OSM buildings whose footprint intersects the bounding box of
 * the provided route segments.  Returns buildings with height + centroid.
 *
 * Falls back to [] on any network/parse error so the caller can degrade
 * gracefully to the orientation heuristic.
 */
export async function fetchBuildingsNearRoute(
  segments: SegmentBounds[]
): Promise<OsmBuilding[]> {
  if (segments.length === 0) return [];

  // Bounding box across all segment endpoints, padded by ~80 m
  const PADDING = 0.0008;
  const lats = segments.flatMap((s) => [s.start.lat, s.end.lat]);
  const lngs = segments.flatMap((s) => [s.start.lng, s.end.lng]);
  const south = (Math.min(...lats) - PADDING).toFixed(6);
  const west  = (Math.min(...lngs) - PADDING).toFixed(6);
  const north = (Math.max(...lats) + PADDING).toFixed(6);
  const east  = (Math.max(...lngs) + PADDING).toFixed(6);

  const query =
    `[out:json][timeout:20];` +
    `way[building](${south},${west},${north},${east});` +
    `out body geom;`;

  try {
    console.log(`Overpass: fetching buildings in bbox (${south},${west},${north},${east})`);
    const res = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 22000,
      }
    );

    const elements: any[] = res.data?.elements ?? [];
    const buildings = elements
      .map(parseBuilding)
      .filter((b): b is OsmBuilding => b !== null);

    console.log(`Overpass: got ${buildings.length} buildings`);
    return buildings;
  } catch (err: any) {
    console.warn('Overpass fetch failed — falling back to orientation heuristic:', err?.message);
    return [];
  }
}

/** Parse a single Overpass way element into an OsmBuilding. */
function parseBuilding(el: any): OsmBuilding | null {
  // Overpass returns geometry as array of {lat, lon} when using `out geom`
  const geometry: Array<{ lat: number; lon: number }> = el.geometry ?? [];
  if (geometry.length < 3) return null;

  const tags = el.tags ?? {};

  // Height resolution priority:
  //   1. tags.height (may be "45" or "45 m" or "45m")
  //   2. tags["building:levels"] × 3.5 m per floor
  //   3. tags["roof:levels"] ignored (not structural height)
  //   4. Default 10 m (~3 floors) — conservative for urban fallback
  let height = 10;
  if (tags.height) {
    const parsed = parseFloat(String(tags.height));
    if (!isNaN(parsed) && parsed > 0) height = parsed;
  } else if (tags['building:levels']) {
    const levels = parseFloat(String(tags['building:levels']));
    if (!isNaN(levels) && levels > 0) height = levels * 3.5;
  }

  // Centroid = average of footprint vertices
  const sumLat = geometry.reduce((s, p) => s + p.lat, 0);
  const sumLng = geometry.reduce((s, p) => s + p.lon, 0);
  const centroid = {
    lat: sumLat / geometry.length,
    lng: sumLng / geometry.length,
  };

  return { id: el.id, height, centroid };
}
