import axios from 'axios';
import { API_BASE } from '../config';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('acadsync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('acadsync_refresh');
      if (refresh && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('acadsync_token', data.data.access_token);
          error.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('acadsync_token');
          localStorage.removeItem('acadsync_refresh');
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
