"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { api } from './api';

interface AuthUser {
    id: string;
    email: string;
    role: 'ADMIN' | 'SCHEDULER' | 'INSTRUCTOR';
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, role: string) => Promise<void>;
    logout: () => void;
    /** Check if user has one of the given roles */
    hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    login: async () => {},
    register: async () => {},
    logout: () => {},
    hasRole: () => false,
});

const TOKEN_KEY = 'rostersync_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Restore token on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (savedToken) {
            setToken(savedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
            // Validate token by fetching profile
            api.get('/auth/me')
                .then(({ data }) => {
                    setUser({ id: data.id, email: data.email, role: data.role });
                })
                .catch((error: unknown) => {
                    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

                    if (status === 401 || status === 403) {
                        localStorage.removeItem(TOKEN_KEY);
                        setToken(null);
                        delete api.defaults.headers.common['Authorization'];
                    }
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        const accessToken = data.access_token;
        localStorage.setItem(TOKEN_KEY, accessToken);
        setToken(accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        setUser(data.user);
    }, []);

    const register = useCallback(async (email: string, password: string, role: string) => {
        const { data } = await api.post('/auth/register', { email, password, role });
        const accessToken = data.access_token;
        localStorage.setItem(TOKEN_KEY, accessToken);
        setToken(accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        setUser(data.user);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('rostersync_active_studio_id');
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    }, []);

    const hasRole = useCallback((...roles: string[]) => {
        return !!user && roles.includes(user.role);
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user,
            isLoading,
            login,
            register,
            logout,
            hasRole,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
