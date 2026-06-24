import axios from 'axios';

let backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';
if (backendUrl && !backendUrl.endsWith('/api') && !backendUrl.endsWith('/api/')) {
  backendUrl = backendUrl.replace(/\/$/, '') + '/api';
}

const api = axios.create({
  baseURL: backendUrl,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
