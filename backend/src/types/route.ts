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
}

export interface Route {
  segments: RouteSegment[];
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
