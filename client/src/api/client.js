/**
 * IMP Centralized API Client
 * Automatically connects to pure PHP backend at /api
 * Handles Bearer token persistence and normalized error responses
 */

const BASE_URL = '/api';

export const apiClient = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('imp_token');

        const headers = {
            'Accept': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (response.status === 401 && !endpoint.includes('/auth/login')) {
                localStorage.removeItem('imp_token');
                localStorage.removeItem('imp_user');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }

            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = {
                    success: false,
                    message: text || `HTTP ${response.status}: Failed to communicate with backend server at ${url}`
                };
            }

            if (!response.ok) {
                const error = new Error(data.message || `API request failed with HTTP ${response.status}`);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (err) {
            console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, err);
            throw err;
        }
    },

    get(endpoint, params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        });
        const qs = query.toString();
        return this.request(qs ? `${endpoint}?${qs}` : endpoint, { method: 'GET' });
    },

    post(endpoint, body = {}) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body = {}) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData,
        });
    }
};

export default apiClient;
