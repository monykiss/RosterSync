'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { StudioProvider } from '@/lib/studio-context';
import { shouldRetryQuery } from '@/lib/api';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000,
                retry: shouldRetryQuery,
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <StudioProvider>
                    {children}
                </StudioProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
