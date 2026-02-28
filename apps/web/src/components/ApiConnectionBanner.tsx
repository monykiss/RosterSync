"use client";

import { AlertTriangle, ServerCrash } from 'lucide-react';
import { useApiHealth, isApiOfflineError } from '@/lib/api';

export function ApiConnectionBanner() {
    const { error, isLoading } = useApiHealth();

    if (isLoading || !error) {
        return null;
    }

    const title = isApiOfflineError(error)
        ? 'Backend unreachable'
        : 'Backend configuration issue';
    const description = isApiOfflineError(error)
        ? 'The web app loaded, but it cannot reach the RosterSync API. Expect empty data and disabled workflows until the backend is reachable.'
        : 'This deployment is missing a working API route or returned an unexpected response. Configure the web API target before demo use.';

    return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-950">
            <div className="flex items-start gap-3">
                {isApiOfflineError(error) ? (
                    <ServerCrash className="mt-0.5 h-4 w-4 text-red-700" />
                ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                )}
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-red-900/85">{description}</p>
                </div>
            </div>
        </div>
    );
}
