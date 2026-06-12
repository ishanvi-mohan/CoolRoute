# Coolroute

Shade-optimized pedestrian routing web application that minimizes sun exposure while keeping routes within 20% of the shortest path distance.

## Features

- 🌳 **Shade-Optimized Routing**: Calculates routes that maximize shade coverage
- ☀️ **Sun Position Tracking**: Real-time solar altitude and azimuth calculations
- 🗺️ **Interactive Maps**: Powered by Mapbox GL JS
- 📍 **Location Services**: Browser geolocation with Places API autocomplete
- 🌡️ **UV Index Display**: Current UV conditions from OpenWeather API
- ⏱️ **Smart Route Constraints**: Never suggests routes >20% longer than shortest path

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Mapbox GL JS for mapping
- Tailwind CSS for styling
- SunCalc for sun position calculations

**Backend:**
- Node.js with Express
- TypeScript
- Turf.js for geospatial calculations
- OpenWeather API for UV data
- OpenStreetMap (Overpass API) for building/tree data

## Prerequisites

- Node.js 18+
- pnpm 8+
- Mapbox account and access token ([Get one here](https://account.mapbox.com/access-tokens/))
- OpenWeather API key ([Get one here](https://home.openweathermap.org/api_keys))

## Getting Started

### 1. Clone and Install

```bash
# Install dependencies
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Frontend
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Backend
OPENWEATHER_API_KEY=your_openweather_api_key_here
PORT=3001
```

See `.env.example` for a template.

### 3. Run Development Servers

```bash
# Start both frontend and backend concurrently
pnpm dev

# Or start them separately:
pnpm dev:frontend  # Frontend on http://localhost:5173
pnpm dev:backend   # Backend on http://localhost:3001
```

### 4. Build for Production

```bash
pnpm build
```

## Project Structure

```
coolroute/
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── services/     # API clients
│   │   ├── utils/        # Helper functions
│   │   ├── hooks/        # Custom React hooks
│   │   └── types/        # TypeScript types
│   └── package.json
├── backend/              # Express server
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Helper functions
│   │   ├── types/        # TypeScript types
│   │   └── middleware/   # Express middleware
│   └── package.json
└── package.json          # Root workspace config
```

## Available Scripts

- `pnpm dev` - Start both frontend and backend in development mode
- `pnpm build` - Build both packages for production
- `pnpm lint` - Run ESLint on all packages
- `pnpm type-check` - Run TypeScript type checking
- `pnpm format` - Format code with Prettier

## How It Works

1. **Route Request**: User inputs start and destination points
2. **Sun Position**: Calculate current solar altitude and azimuth using SunCalc
3. **Candidate Routes**: Fetch 3-5 alternative routes from Mapbox Directions API
4. **Shade Scoring**: For each route segment:
   - Fetch building heights from OpenStreetMap
   - Calculate shadow coverage based on sun position
   - Apply street orientation heuristics
   - Assign shade score (0-1)
5. **Route Selection**: Choose route with highest shade score within 20% distance constraint
6. **Display**: Show route on map with shade coverage percentage, UV index, and detour distance

## API Endpoints

### Backend

- `GET /api/health` - Health check endpoint
- `POST /api/routes` - Calculate shade-optimized route
  ```json
  {
    "start": { "lat": 37.7749, "lng": -122.4194 },
    "destination": { "lat": 37.7849, "lng": -122.4094 },
    "timestamp": "2024-06-12T14:30:00Z"
  }
  ```

## Development Notes

- Frontend proxies `/api` requests to backend during development
- TypeScript strict mode is enabled across all packages
- Hot module replacement works in both frontend and backend
- Building height data from OSM is incomplete in many cities - graceful fallbacks are implemented

## Constraints

- **Walking Only**: v1 does not support transit, cycling, or driving routes
- **20% Maximum Detour**: Routes never exceed 120% of shortest path distance
- **Current Time Only**: Routes calculated for present time (no future predictions)
- **Data Gaps**: Building height coverage varies by city

## License

Private project - All rights reserved

## Contributing

This is a personal project. Please open an issue for bugs or suggestions.
