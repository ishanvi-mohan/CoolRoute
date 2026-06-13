import { Location } from './location';

export interface RouteSegment {
  start: Location;
  end: Location;
  distance: number;
  shadeScore: number;
  bearing: number;
  shadedSide: 'left' | 'right' | 'either';
}

export interface Route {
  segments: RouteSegment[];
  /** Road-following lat/lng points decoded from the encoded polyline */
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
  isSameRoute: boolean;
}

export interface RouteRequest {
  start: Location;
  destination: Location;
  timestamp?: Date;
}
