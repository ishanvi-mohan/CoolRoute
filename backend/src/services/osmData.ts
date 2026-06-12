// TODO: Uncomment when implementing Overpass API queries
// import axios from 'axios';
// const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export async function getBuildingHeights(
  _minLat: number,
  _minLng: number,
  _maxLat: number,
  _maxLng: number
): Promise<Map<string, number>> {
  // TODO: Implement Overpass API query for building heights
  // This is a placeholder that returns an empty map

  const buildingHeights = new Map<string, number>();

  // Example query structure (not implemented):
  // [out:json];
  // way["building"]["height"](minLat,minLng,maxLat,maxLng);
  // out body;

  return buildingHeights;
}

export async function getTreeCanopy(
  _minLat: number,
  _minLng: number,
  _maxLat: number,
  _maxLng: number
): Promise<Map<string, boolean>> {
  // TODO: Implement tree canopy data fetching
  // This is a placeholder that returns an empty map

  const treeCanopy = new Map<string, boolean>();

  return treeCanopy;
}
