/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAPBOX_ACCESS_TOKEN: string
  /** Deployed backend API base, e.g. https://cool-route-backend.vercel.app/api. Unset locally → '/api' via dev proxy. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
