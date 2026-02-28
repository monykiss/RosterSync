"use client";

import { useStudio } from '@/lib/studio-context';
import { getTimezoneAbbr } from '@/lib/timezone';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function StudioSwitcher() {
    const { activeStudio, studios, switchStudio, isLoading } = useStudio();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (isLoading) {
        return (
            <div className="px-3 py-2">
                <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
            </div>
        );
    }

    if (studios.length === 0) {
        return (
            <div className="px-3 py-2 text-xs text-slate-400">
                No studios configured
            </div>
        );
    }

    return (
        <div ref={ref} className="relative px-3 py-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left"
            >
                <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                        {activeStudio?.name ?? 'Select Studio'}
                    </div>
                    {activeStudio && (
                        <div className="text-[10px] text-slate-400">
                            {getTimezoneAbbr(activeStudio.timezone)}
                        </div>
                    )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
                    {studios.map(studio => (
                        <button
                            key={studio.id}
                            onClick={() => {
                                switchStudio(studio.id);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-700 truncate">
                                    {studio.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {studio.timezone} ({getTimezoneAbbr(studio.timezone)})
                                </div>
                            </div>
                            {activeStudio?.id === studio.id && (
                                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
