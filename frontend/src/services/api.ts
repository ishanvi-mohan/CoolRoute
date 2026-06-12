import axios from 'axios';
import { RouteRequest, RouteComparison } from '../types/route';

const api = axios.create({
  baseURL: '/api',
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
