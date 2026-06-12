# CLAUDE.md
We're building the app described in @SPEC.md. Read that file for general architectural tasks or to double-check the exact database structure, tech stack or application architecture. 

Whenever working with third-party libraries or something similar, you MUST look up the official documentation to ensure that you're working with up-to-date information.
Use the DocsExplorer subagent for efficient documentation lookup.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coolroute is a web application that routes pedestrians along the shadiest path between two points, minimizing sun exposure but must **never suggest a route more than 20% longer** than the shortest available route. 

**Key Product Requirements** (see SPEC.md for full details):
- Browser-based geolocation for starting point
- Shade-optimized routing based on sun position, building shadows, tree canopy, and street orientation
- 20% max detour constraint — never suggest routes >20% longer than shortest path
- Real-time shade calculation using current date/time and location
- Display shade coverage %, estimated walk time, UV index, and detour distance

## Tech Stack

**Frontend:**
- React for UI components
- Mapbox GL JS or Google Maps JS SDK for map rendering and base routing
- SunCalc.js for client-side sun position calculations (solar altitude/azimuth)

**Backend:**
- Node.js or Python for route scoring logic
- REST API to calculate shade scores for route segments

**Data Sources:**
- Google Maps Platform or Mapbox for routing and maps
- OpenStreetMap for building heights and tree canopy data
- OpenWeatherMap or Open-Meteo for UV index
- SunCalc.js for sun position (client-side, no API needed)

**Hosting:**
- Vercel or Railway for deployment

## Architecture

### Route Calculation Flow

1. **Input Processing**: User provides start and destination (with Places API autocomplete)
2. **Base Route Generation**: Fetch 3-5 alternative walking routes from mapping provider
3. **Shade Scoring**: For each route segment:
   - Calculate sun position (altitude + azimuth) for current time
   - Determine shadow coverage from building heights and tree canopy
   - Apply street orientation heuristics (N-S streets better for morning/evening, E-W for midday)
   - Assign shade score to segment
4. **Route Selection**: Choose route with best shade score within 20% distance constraint
5. **Fallback Logic**:
   - If no shadier route exists within constraint, return shortest route
   - Skip optimization at night or when UV index is low
   - Use street-orientation heuristics where building height data is unavailable

### Key Technical Considerations

**Shadow Calculation:**
- Building shadows require 3D height data from OpenStreetMap
- Data coverage is sparse in many cities — implement fallback to street-orientation heuristics
- Shadow calculations per segment can be expensive — evaluate client-side vs server-side tradeoff

**Time Sensitivity:**
- Routes are only valid for the time of generation
- Include timestamp on results and provide "Recalculate" button
- Shadow coverage changes throughout the day

**Performance:**
- Cache building height data for frequently accessed areas
- Pre-compute street orientation heuristics where possible
- Consider limiting calculation to top 3-5 candidate routes rather than exhaustive search

## Development Commands

Once the project is initialized, use these commands:

**Frontend (React):**
```bash
npm install           # Install dependencies
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run tests
```

**Backend:**
```bash
# Node.js
npm install
npm run dev          # Start dev server with hot reload
npm test             # Run tests
npm run lint

# Python (if chosen)
pip install -r requirements.txt
python app.py        # Start dev server
pytest               # Run tests
```

## Code Organization

**Frontend Structure:**
```
src/
  components/        # React components (RouteInput, MapView, RouteResults)
  services/          # API clients (maps, geocoding, backend route scoring)
  utils/             # SunCalc integration, shade calculations
  hooks/             # Custom React hooks (useGeolocation, useRoutes)
```

**Backend Structure:**
```
api/
  routes/            # Route calculation endpoints
  services/          # Shadow scoring logic, OSM data fetching
  utils/             # Sun position helpers, geometry calculations
```

## Important Constraints

- **20% Distance Rule**: All route suggestions MUST be ≤120% of shortest path distance
- **Walking Only**: v1 does not support transit, cycling, or driving
- **Data Gaps**: Building height data is incomplete — always provide graceful fallback
- **No Future Prediction**: Routes calculated for current time only (no historical or future routing)
