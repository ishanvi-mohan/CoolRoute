export interface Location {
  lat: number;
  lng: number;
}

export interface RouteRequest {
  start: Location;
  destination: Location;
  timestamp: Date;
}

export interface RouteSegment {
  start: Location;
  end: Location;
  distance: number;
  shadeScore: number;
  /** Compass bearing of this segment in degrees (0–360) */
  bearing: number;
  /** Which side of the street is shadier based on sun position */
  shadedSide: 'left' | 'right' | 'either';
}

export interface Route {
  segments: RouteSegment[];
  /** Decoded lat/lng points following actual road geometry */
  polyline: Location[];
  totalDistance: number;
  estimatedTime: number;
  shadeCoverage: number;
  detourDistance: number;
  uvIndex: number;
}

export interface RouteComparison {
  shadedRoute: Route;
  shortestRoute: Route;
  /** true when the shade-optimal route is also the shortest */
  isSameRoute: boolean;
}
