import axios from 'axios';

const SESSION_FLAG = 'cc_session';

function resolveBaseURL(): string {
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (rawBase) {
    return rawBase.endsWith('/api') || rawBase.endsWith('/cc-api') ? rawBase : `${rawBase}/api`;
  }
  // Dev local: proxy Next.js (/api → backend) mantém cookie HttpOnly na mesma origem
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return 'http://localhost:8000/api';
}

const api = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 30000,
  maxRedirects: 5,
  withCredentials: true,
});

function clearAuthSessionLocal() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('cached_user');
  sessionStorage.removeItem(SESSION_FLAG);
  // Limpeza legada de versões anteriores
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage =
        typeof window !== 'undefined' && window.location.pathname.includes('/login');

      clearAuthSessionLocal();

      if (!isLoginPage) {
        typeof window !== 'undefined' && (window.location.href = '/login');
      }
    }
    return Promise.reject(error);
  }
);

export { SESSION_FLAG, clearAuthSessionLocal };
export default api;
