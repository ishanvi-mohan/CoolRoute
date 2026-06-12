export interface SunPosition {
  altitude: number;
  azimuth: number;
}

export interface ShadeData {
  buildingHeights: Map<string, number>;
  treeCanopy: Map<string, boolean>;
  streetOrientation: number;
}
