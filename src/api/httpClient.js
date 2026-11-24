// One shared axios instance for talking to OUR backend.
import axios from 'axios';

// VITE_API_URL = full address of the backend (e.g. https://my-server.com). Empty = same origin (dev proxy).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const http = axios.create({ baseURL: `${API_URL}/api` });

// Attach the login token to every request
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is expired/invalid, log out and go to the login page
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Turns any axios error into a readable sentence for the UI
export function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Something went wrong';
}

export default http;
