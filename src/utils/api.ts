import axios from 'axios';
import { createGlobalState } from 'react-global-hooks';

export const isAuthorizedState = createGlobalState(false);

export const apiClient = axios.create();
let toastHandler: ((payload: { title: string; description?: string; tone?: 'success' | 'error' | 'warning' | 'info' }) => void) | null = null;

export function registerToastHandler(handler: typeof toastHandler) {
  toastHandler = handler;
}

apiClient.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('QWEN_UI_AUTH_TOKEN');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('QWEN_UI_AUTH_TOKEN');
      isAuthorizedState.set(false);
    }
    if (typeof window !== 'undefined' && toastHandler) {
      const status = error?.response?.status;
      const description =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Request failed';
      toastHandler({
        title: status ? `Request failed (${status})` : 'Request failed',
        description,
        tone: status && status < 500 ? 'warning' : 'error',
      });
    }
    return Promise.reject(error);
  },
);
