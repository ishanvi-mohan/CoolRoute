import axios from 'axios';
import { RouteRequest, RouteComparison } from '../types/route';

// API base resolution:
//  - VITE_API_URL (if set) always wins — lets you point at any backend.
//  - Otherwise in a production build, use the deployed backend on Vercel.
//  - Otherwise (local dev) use '/api', which the Vite dev proxy forwards to localhost.
const PROD_API_URL = 'https://cool-route-backend.vercel.app/api';
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PROD_API_URL : '/api'),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = async (): Promise<{ status: string }> => {
  const response = await api.get('/health');
  return response.data;
};

export const calculateRoute = async (request: RouteRequest): Promise<RouteComparison> => {
  const response = await api.post('/routes', request);
  return response.data;
};

export default api;
