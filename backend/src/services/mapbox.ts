import axios from 'axios';

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/walking';

export interface MapboxRoute {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat]
  };
  distance: number; // meters
  duration: number; // seconds
  legs: Array<{
    distance: number;
    duration: number;
    steps: Array<{
      distance: number;
      duration: number;
      geometry: {
        type: 'LineString';
        coordinates: [number, number][];
      };
      name: string;
      instruction: string;
    }>;
  }>;
}

export interface MapboxDirectionsResponse {
  code: string;
  routes: MapboxRoute[];
  waypoints: Array<{
    distance: number;
    name: string;
    location: [number, number];
  }>;
}

export async function getWalkingRoutes(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<MapboxRoute[]> {
  const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error('Mapbox access token not configured');
  }

  const coordinates = `${startLng},${startLat};${endLng},${endLat}`;

  try {
    const response = await axios.get<MapboxDirectionsResponse>(
      `${MAPBOX_DIRECTIONS_URL}/${coordinates}`,
      {
        params: {
          alternatives: true, // Get up to 2 alternative routes
          geometries: 'geojson',
          overview: 'full',
          steps: true,
          access_token: MAPBOX_ACCESS_TOKEN,
        },
      }
    );

    if (response.data.code !== 'Ok') {
      throw new Error(`Mapbox routing error: ${response.data.code}`);
    }

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No routes found');
    }

    return response.data.routes;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Mapbox API error: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}
