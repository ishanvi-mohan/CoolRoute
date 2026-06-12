# Coolroute — Product Specification

## Overview

Coolroute is a web app that routes pedestrians along the shadiest path between two points. It minimizes sun exposure without adding unreasonable travel time.

---

## Core Requirements

### 1. Location Permission
- Request browser geolocation on first load
- Use current location as default starting point
- Gracefully handle denial (fall back to manual input)

### 2. Route Input
- Input fields: **Start** and **Destination**
- Autocomplete via Google Places API (or equivalent)
- Support for current location as start point via "Use my location" button

### 3. Shade-Optimized Routing

The core routing logic must account for:

- **Sun position** — calculated from current date, time, and user coordinates (solar altitude + azimuth)
- **Building/tree shadow casting** — derived from building height data (e.g. OpenStreetMap + building footprints) or tree canopy data where available
- **Street orientation** — north-south streets shade better in morning/evening; east-west streets shade better at midday

**Route scoring:** Each candidate route segment gets a shade score based on estimated shadow coverage at the time of travel.

### 4. Route Length Constraint

- Coolroute must **never suggest a route more than 20% longer** than the shortest available route
- If no shadier route exists within the 20% threshold, return the standard shortest route with a note
- Display both the shade-optimized distance and the shortest-route distance for transparency

---

## Route Output

Each suggested route should display:

| Field | Description |
|---|---|
| Estimated walk time | Based on average walking speed (~5 km/h) |
| Distance | Total route distance in km/m |
| Shade coverage % | Estimated % of route in shade |
| Detour added | Extra distance vs. shortest path (e.g. "+180m") |
| Sun intensity | Current UV index at location |

Show a visual map with the route rendered. Shade-heavy segments highlighted differently from exposed segments.

---

## Constraints & Edge Cases

- **Time sensitivity:** Shadow coverage changes with time. Routes are valid for the time of generation. Add a timestamp and a "Recalculate" button.
- **No shade available:** If shade coverage is minimal across all routes (e.g. open fields, industrial areas), inform the user and return shortest path.
- **Night / overcast:** If UV index is low or it's nighttime, skip shade optimization and return shortest path with a note ("No shade optimization needed right now").
- **Data gaps:** Building height data is incomplete in many cities. Fallback to street-orientation-based heuristics where 3D data is unavailable.

---

## Data Sources (Candidates — verify availability and cost)

| Data | Source |
|---|---|
| Routing & maps | Google Maps Platform / Mapbox |
| Building heights | OpenStreetMap (3D buildings) / Microsoft Building Footprints |
| Tree canopy | OpenStreetMap + local municipal datasets where available |
| Sun position | SunCalc.js (open source, client-side) |
| UV index | OpenWeatherMap API or Open-Meteo |

---

## Tech Stack (Suggested)

- **Frontend:** React + Mapbox GL JS (or Google Maps JS SDK)
- **Backend:** Node.js / Python — route scoring logic
- **Sun position:** SunCalc.js (runs client-side, no API needed)
- **Hosting:** Vercel / Railway

---

## Out of Scope (v1)

- Transit, cycling, or driving routes — walking only
- Indoor routing
- Real-time cloud cover affecting shade
- Historical shade data or future time prediction
- Native mobile app

---

## Open Questions

1. **How accurate does shade estimation need to be?** Building shadow casting requires 3D height data, which is sparse in many cities. Do we accept lower accuracy with a disclaimer, or restrict launch to cities with good 3D data?
2. **Routing engine:** Build custom segment scoring on top of a base routing API, or find a routing engine that supports custom edge weights?
3. **Performance:** Shadow calculations per route segment could be expensive at scale. Client-side vs. server-side tradeoff needs evaluation.