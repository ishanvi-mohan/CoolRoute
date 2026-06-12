import { Location } from './location';

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
  isSameRoute: boolean;
}

export interface RouteRequest {
  start: Location;
  destination: Location;
  timestamp?: Date;
}
