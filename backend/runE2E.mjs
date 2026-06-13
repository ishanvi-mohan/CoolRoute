import 'dotenv/config';
import { calculateShadeOptimizedRoute } from './dist/services/shadeScoring.js';

const req = {
  start:       { lat: 22.2849, lng: 114.1577 }, // Hong Kong Station, Central
  destination: { lat: 22.2783, lng: 114.1747 }, // Wan Chai (~1.8 km E)
  timestamp:   new Date('2026-06-13T08:30:00Z'), // HK 16:30, sun in the west
};

const t0 = Date.now();
try {
  const r = await calculateShadeOptimizedRoute(req);
  const f = (x) => Math.round(x);
  console.log(`\n--- RESULT (${Date.now()-t0} ms) ---`);
  console.log('isSameRoute:', r.isSameRoute);
  console.log(`shortest: dist=${f(r.shortestRoute.totalDistance)}m  shade=${r.shortestRoute.shadeCoverage}%  detour=${r.shortestRoute.detourDistance}m  segs=${r.shortestRoute.segments.length}`);
  console.log(`shaded:   dist=${f(r.shadedRoute.totalDistance)}m  shade=${r.shadedRoute.shadeCoverage}%  detour=${r.shadedRoute.detourDistance}m  segs=${r.shadedRoute.segments.length}`);
  const pct = r.shadedRoute.totalDistance / r.shortestRoute.totalDistance;
  console.log('detour ratio:', pct.toFixed(3), pct <= 1.2 ? 'OK (<=1.20)' : 'VIOLATION');
  const sides = r.shadedRoute.segments.map(s => s.shadedSide);
  const tally = sides.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{});
  console.log('shadedSide tally:', JSON.stringify(tally));
  console.log('uvIndex:', r.shadedRoute.uvIndex);
} catch (e) {
  console.log('E2E ERROR:', e.message);
}
