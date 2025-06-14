import axios from 'axios';

/**
 * Create an Axios instance with common configuration
 */
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
apiClient.interceptors.request.use(
  async (config: any) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
apiClient.interceptors.response.use(
  (response: any) => {
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;
    
    // Handle token refresh or other error handling logic here
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Example: Attempt to refresh token
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await apiClient.post('/api/auth/refresh', {
            refresh_token: refreshToken,
          });
          
          if (response.data.token) {
            localStorage.setItem('auth_token', response.data.token);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
            return apiClient(originalRequest);
          }
        }
        
        // If we reach here, we couldn't refresh the token, so we should logout
        // This would typically be handled by a central auth service
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      } catch (_refreshError) {
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
export { apiClient };