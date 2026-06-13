import https from 'node:https';
import dns   from 'node:dns';
import axios from 'axios';

// Disable connection pooling so each request gets a fresh socket.
// Pooled keep-alive connections are closed by Google after a short idle;
// the reconnect triggers Node 18 happy-eyeballs (IPv4+IPv6 in parallel).
// If IPv6 is unreachable both fail simultaneously → AggregateError.
// keepAlive:false + explicit IPv4 lookup eliminates both failure modes.
const httpsAgent = new https.Agent({
  keepAlive: false,
  lookup: (hostname, opts, cb) =>
    dns.lookup(hostname, { ...opts, family: 4 }, cb),
});

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Decode a Google Maps encoded polyline into lat/lng pairs. */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export interface GoogleRoute {
  distance: number; // metres
  duration: number; // seconds
  /** Decoded road-following polyline for the full route */
  polyline: Array<{ lat: number; lng: number }>;
  steps: Array<{
    distance: number;
    duration: number;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
  }>;
}

export async function getWalkingRoutes(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<GoogleRoute[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('Google Maps API key not configured');

  const body = {
    origin:      { location: { latLng: { latitude: startLat, longitude: startLng } } },
    destination: { location: { latLng: { latitude: endLat,   longitude: endLng   } } },
    travelMode: 'WALK',
    computeAlternativeRoutes: true,
    units: 'METRIC',
  };

  console.log(`Routes API request: (${startLat},${startLng}) → (${endLat},${endLng})`);

  let response;
  try {
    response = await axios.post(ROUTES_URL, body, {
      httpsAgent,
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'routes.distanceMeters',
          'routes.duration',
          'routes.legs.polyline',          // full road-following polyline for the leg
          'routes.legs.steps.distanceMeters',
          'routes.legs.steps.staticDuration',
          'routes.legs.steps.startLocation',
          'routes.legs.steps.endLocation',
        ].join(','),
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  } catch (err: any) {
    console.error('Routes API threw:', err?.constructor?.name, String(err));
    if (err?.response) {
      console.error('  HTTP status:', err.response.status);
      console.error('  Response body:', JSON.stringify(err.response.data));
    }
    if (err?.cause) {
      console.error('  Cause:', String(err.cause));
    }
    const detail =
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      (err?.response?.status ? `HTTP ${err.response.status}` : '') ||
      err?.cause?.message ||
      err?.message ||
      String(err);
    throw new Error(`Google Routes API error: ${detail}`);
  }

  const routes = response.data?.routes ?? [];
  if (routes.length === 0) throw new Error('No routes found');

  return routes.map((route: any) => {
    const steps = route.legs?.[0]?.steps ?? [];
    const encodedPolyline = route.legs?.[0]?.polyline?.encodedPolyline ?? '';

    return {
      distance: route.distanceMeters ?? 0,
      duration: parseInt(String(route.duration ?? '0').replace('s', ''), 10),
      polyline: encodedPolyline ? decodePolyline(encodedPolyline) : [],
      steps: steps.map((step: any) => ({
        distance: step.distanceMeters ?? 0,
        duration: parseInt(String(step.staticDuration ?? '0').replace('s', ''), 10),
        startLat: step.startLocation?.latLng?.latitude  ?? 0,
        startLng: step.startLocation?.latLng?.longitude ?? 0,
        endLat:   step.endLocation?.latLng?.latitude    ?? 0,
        endLng:   step.endLocation?.latLng?.longitude   ?? 0,
      })),
    };
  });
}
