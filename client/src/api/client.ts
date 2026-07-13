import axios, { type AxiosRequestConfig } from 'axios';
import { cacheGet, cacheSet, queueAdd } from '../lib/offline/db';
import { useOfflineStore } from '../store/offlineStore';

// baseURL ריק = relative URLs (/api/...)
// בפיתוח: Vite proxy מנתב /api → localhost:3018
// בייצור: nginx reverse proxy מנתב /api → server
const apiClient = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

function cacheableGetUrl(url?: string): string | null {
  if (!url || !url.startsWith('/api/')) return null;
  // don't cache auth
  if (url.startsWith('/api/auth')) return null;
  return url;
}

function mutationLabel(method: string, url: string): string {
  const m = method.toUpperCase();
  if (url.includes('/expenses')) return m === 'DELETE' ? 'מחיקת הוצאה' : 'הוצאה';
  if (url.includes('/places')) return m === 'DELETE' ? 'מחיקת מקום' : 'מקום';
  if (url.includes('/timeline')) return 'זיכרון / ציר זמן';
  if (url.includes('/links')) return 'קישור';
  if (url.includes('/decisions')) return 'החלטה / הצבעה';
  if (url.includes('/flights')) return 'טיסה';
  return `${m} ${url}`;
}

// שלח JWT בכל בקשה
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cache successful GETs; queue offline mutations
apiClient.interceptors.response.use(
  async (response) => {
    const method = (response.config.method || 'get').toLowerCase();
    const url = response.config.url || '';
    if (method === 'get') {
      const key = cacheableGetUrl(url);
      if (key) {
        try {
          await cacheSet(key, response.data);
        } catch {
          /* ignore */
        }
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const config = error.config as AxiosRequestConfig | undefined;
    const method = (config?.method || 'get').toLowerCase();
    const url = config?.url || '';
    const isNetwork =
      !error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error';
    const isSync = Boolean(config?.headers && (config.headers as any)['X-Offline-Sync']);

    // Offline GET → serve cache
    if (isNetwork && method === 'get' && url) {
      const key = cacheableGetUrl(url);
      if (key) {
        const cached = await cacheGet(key);
        if (cached != null) {
          return {
            data: cached,
            status: 200,
            statusText: 'OK (offline cache)',
            headers: {},
            config: config!,
          };
        }
      }
    }

    // Offline mutation → queue (not while replaying sync)
    if (
      isNetwork &&
      !isSync &&
      config &&
      ['post', 'put', 'patch', 'delete'].includes(method) &&
      url.startsWith('/api/')
    ) {
      try {
        await queueAdd({
          method: method.toUpperCase(),
          url,
          body: config.data
            ? typeof config.data === 'string'
              ? JSON.parse(config.data)
              : config.data
            : undefined,
          label: mutationLabel(method, url),
        });
        await useOfflineStore.getState().refreshPending();

        return {
          data: {
            offlineQueued: true,
            message: 'נשמר במכשיר — יסונכרן כשיהיה אינטרנט',
          },
          status: 202,
          statusText: 'Accepted (offline queue)',
          headers: {},
          config: config!,
        };
      } catch {
        /* fall through */
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
