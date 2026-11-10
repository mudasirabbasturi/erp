import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('imp_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('imp_token') || null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifySession = async () => {
            if (token) {
                try {
                    const res = await apiClient.get('/auth/me');
                    if (res.success && res.data?.user) {
                        setUser(res.data.user);
                        localStorage.setItem('imp_user', JSON.stringify(res.data.user));
                    }
                } catch (e) {
                    logout();
                }
            }
            setIsLoading(false);
        };
        verifySession();
    }, [token]);

    const login = async (username, password) => {
        const res = await apiClient.post('/auth/login', { username, password });
        if (res.success && res.data) {
            setToken(res.data.token);
            setUser(res.data.user);
            localStorage.setItem('imp_token', res.data.token);
            localStorage.setItem('imp_user', JSON.stringify(res.data.user));
            return res.data.user;
        }
        throw new Error(res.message || 'Login failed');
    };

    const logout = async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch (e) {
            // ignore network failure on logout
        } finally {
            setToken(null);
            setUser(null);
            localStorage.removeItem('imp_token');
            localStorage.removeItem('imp_user');
            window.location.href = '/login';
        }
    };

    const isSuperAdmin = user?.is_super_admin === 1;

    const hasPermission = (permissionSlug) => {
        if (isSuperAdmin) return true;
        const perms = user?.permissions || [];
        return perms.includes(permissionSlug);
    };

    const canViewColumn = (entity, fieldName) => {
        if (isSuperAdmin) return true;
        const fieldPerms = user?.field_permissions || [];
        const match = fieldPerms.find(fp => fp.entity === entity && fp.field_name === fieldName);
        if (match) {
            return match.can_view === 1;
        }
        return true; // Default viewable unless explicitly restricted
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            isAuthenticated: !!token,
            isSuperAdmin,
            hasPermission,
            canViewColumn,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

