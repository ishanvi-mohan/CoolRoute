export interface OsmBuilding {
  id: number;
  /** Height in metres (parsed from tags.height or building:levels × 3.5) */
  height: number;
  /** Approximate centroid of the building footprint */
  centroid: { lat: number; lng: number };
}
