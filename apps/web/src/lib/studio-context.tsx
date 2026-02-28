"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { api } from './api';
import { useAuth } from './auth-context';

interface StudioInfo {
    id: string;
    name: string;
    timezone: string;
}

interface UserProfile {
    id: string;
    email: string;
    role: string;
    instructorId: string | null;
    instructorName: string | null;
    studios: StudioInfo[];
}

interface StudioContextValue {
    /** Currently active studio */
    activeStudio: StudioInfo | null;
    /** All studios the user can access */
    studios: StudioInfo[];
    /** Switch to a different studio */
    switchStudio: (studioId: string) => void;
    /** User profile data */
    user: UserProfile | null;
    /** Loading state */
    isLoading: boolean;
}

const StudioContext = createContext<StudioContextValue>({
    activeStudio: null,
    studios: [],
    switchStudio: () => {},
    user: null,
    isLoading: true,
});

const STUDIO_STORAGE_KEY = 'rostersync_active_studio_id';

export function StudioProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [activeStudioId, setActiveStudioId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user profile and studios
    useEffect(() => {
        let cancelled = false;
        async function loadProfile() {
            try {
                const { data } = await api.get<UserProfile>('/auth/me');
                if (cancelled) return;
                setUser(data);

                // Restore saved studio or pick first
                const savedId = localStorage.getItem(STUDIO_STORAGE_KEY);
                const validStudio = data.studios.find(s => s.id === savedId);
                const defaultStudio = validStudio || data.studios[0];
                if (defaultStudio) {
                    setActiveStudioId(defaultStudio.id);
                    api.defaults.headers.common['x-studio-id'] = defaultStudio.id;
                }
            } catch (error: unknown) {
                const status = axios.isAxiosError(error) ? error.response?.status : undefined;
                const canFallbackToStudios = status === 401 || status === 403;

                if (canFallbackToStudios) {
                    try {
                        const { data: studios } = await api.get<StudioInfo[]>('/studios');
                        if (cancelled) return;
                        const savedId = localStorage.getItem(STUDIO_STORAGE_KEY);
                        const validStudio = studios.find((s: StudioInfo) => s.id === savedId);
                        const defaultStudio = validStudio || studios[0];
                        if (defaultStudio) {
                            setActiveStudioId(defaultStudio.id);
                            api.defaults.headers.common['x-studio-id'] = defaultStudio.id;
                        }
                        setUser({
                            id: 'demo-admin-user',
                            email: 'admin@rostersyncos.io',
                            role: 'ADMIN',
                            instructorId: null,
                            instructorName: null,
                            studios,
                        });
                    } catch {
                        // No studios available yet
                    }
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }
        loadProfile();
        return () => { cancelled = true; };
    }, [token]);

    const switchStudio = useCallback((studioId: string) => {
        setActiveStudioId(studioId);
        localStorage.setItem(STUDIO_STORAGE_KEY, studioId);
        api.defaults.headers.common['x-studio-id'] = studioId;
    }, []);

    const studios = user?.studios ?? [];
    const activeStudio = studios.find(s => s.id === activeStudioId) ?? null;

    return (
        <StudioContext.Provider value={{ activeStudio, studios, switchStudio, user, isLoading }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    return useContext(StudioContext);
}
