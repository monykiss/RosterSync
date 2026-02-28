"use client";

import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: { label: string; onClick?: () => void; href?: string };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                {icon}
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
            {action && (
                action.href ? (
                    <a href={action.href}>
                        <Button size="sm">{action.label}</Button>
                    </a>
                ) : (
                    <Button size="sm" onClick={action.onClick}>{action.label}</Button>
                )
            )}
        </div>
    );
}
