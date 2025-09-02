import axios from 'axios';

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || 'http://localhost:8000';

export const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = process.env.NEXT_PUBLIC_API_TOKEN || 'dev';
  config.headers = config.headers || {};
  (config.headers as any)['Authorization'] = `Bearer ${token}`;
  return config;
});

export default api;
