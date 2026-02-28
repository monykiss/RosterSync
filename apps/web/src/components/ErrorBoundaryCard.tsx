"use client";

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryCardProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorBoundaryCard({
    title = 'Something went wrong',
    message = 'An error occurred while loading this page. Please try again.',
    onRetry,
}: ErrorBoundaryCardProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-md text-center mb-6">{message}</p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Try Again
                </Button>
            )}
        </div>
    );
}
