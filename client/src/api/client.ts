import axios from 'axios';

// baseURL ריק = relative URLs (/api/...)
// בפיתוח: Vite proxy מנתב /api → localhost:3018
// בייצור: nginx reverse proxy מנתב /api → server
const apiClient = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

// שלח JWT בכל בקשה
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// טיפול בשגיאות 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
