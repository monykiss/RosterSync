"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { forwardRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type SessionUI = {
    id: string;
    effectiveClassType: string;
    effectiveInstructor: string;
    startDateTimeUTC: string;
    endDateTimeUTC: string;
    status: 'SCHEDULED' | 'NEEDS_COVER' | 'COVER_PENDING' | 'COVER_ASSIGNED' | 'CANCELLED';
    syncStatus?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | null;
    conflicts: { type: string; severity: string; message: string; }[];
    overrideReason?: string | null;
};

const STATUS_CONFIG: Record<SessionUI['status'], { label: string; className: string }> = {
    SCHEDULED: { label: 'Scheduled', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    NEEDS_COVER: { label: 'Needs Cover', className: 'bg-amber-50 text-amber-800 border-amber-200' },
    COVER_PENDING: { label: 'Cover Pending', className: 'bg-orange-50 text-orange-800 border-orange-200' },
    COVER_ASSIGNED: { label: 'Assigned', className: 'bg-blue-50 text-blue-800 border-blue-200' },
    CANCELLED: { label: 'Cancelled', className: 'bg-slate-50 text-slate-400 border-slate-200 line-through' },
};

export interface QuickAction {
    label: string;
    onClick: () => void;
    show: boolean;
}

interface SessionCardProps {
    session: SessionUI;
    onClick: () => void;
    isSelected?: boolean;
    onSelect?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    quickActions?: QuickAction[];
}

export const SessionCard = forwardRef<HTMLDivElement, SessionCardProps>(
    function SessionCard({ session, onClick, isSelected, onSelect, onKeyDown: externalKeyDown, quickActions }, ref) {
        const [showActions, setShowActions] = useState(false);
        const startTime = format(parseISO(session.startDateTimeUTC), 'h:mm a');
        const endTime = format(parseISO(session.endDateTimeUTC), 'h:mm a');

        const hasBlockingConflict = session.conflicts.some(c => c.severity === 'CRITICAL');
        const hasWarning = session.conflicts.some(c => c.severity === 'WARNING');
        const conflictCount = session.conflicts.length;
        const isSyncFailed = session.syncStatus === 'FAILED';
        const isSyncPending = session.syncStatus === 'PENDING' || session.syncStatus === 'PROCESSING';
        const isSynced = session.syncStatus === 'SUCCEEDED';

        const statusConfig = STATUS_CONFIG[session.status];

        const handleClick = (e: React.MouseEvent) => {
            if ((e.metaKey || e.ctrlKey) && onSelect) {
                e.preventDefault();
                onSelect(e);
            } else {
                onClick();
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
            } else if (externalKeyDown) {
                externalKeyDown(e);
            }
        };

        const ariaLabel = `${startTime} ${session.effectiveClassType} with ${session.effectiveInstructor}, ${statusConfig.label}${conflictCount > 0 ? `, ${conflictCount} conflict${conflictCount > 1 ? 's' : ''}` : ''}`;

        // Left border accent based on most important status
        const borderAccent = hasBlockingConflict
            ? 'border-l-red-500'
            : session.status === 'NEEDS_COVER' || session.status === 'COVER_PENDING'
                ? 'border-l-amber-400'
                : session.status === 'COVER_ASSIGNED'
                    ? 'border-l-blue-500'
                    : isSynced
                        ? 'border-l-green-500'
                        : 'border-l-transparent';

        const visibleActions = quickActions?.filter(a => a.show) ?? [];

        return (
            <Card
                ref={ref}
                tabIndex={0}
                role="button"
                aria-label={ariaLabel}
                className={`
                    p-2.5 cursor-pointer transition-all border-l-[3px] rounded-md relative group
                    ${borderAccent}
                    ${isSelected
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1
                `}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            >
                {/* Quick Actions Menu */}
                {visibleActions.length > 0 && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                                className="w-5 h-5 rounded bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50"
                                aria-label="Quick actions"
                            >
                                <MoreHorizontal className="w-3 h-3 text-slate-500" />
                            </button>
                            {showActions && (
                                <div
                                    className="absolute right-0 top-6 bg-white border rounded-md shadow-lg py-1 min-w-[140px] z-20"
                                    onMouseLeave={() => setShowActions(false)}
                                >
                                    {visibleActions.map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowActions(false);
                                                action.onClick();
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Row 1: Time range */}
                <div className="text-[11px] font-medium text-slate-400 tracking-wide">
                    {startTime} – {endTime}
                </div>

                {/* Row 2: Class Type (dominant) */}
                <h4 className="font-semibold text-sm text-slate-900 leading-tight truncate mt-0.5">
                    {session.effectiveClassType}
                </h4>

                {/* Row 3: Instructor */}
                <div className="text-xs text-slate-600 truncate">
                    {session.effectiveInstructor}
                </div>

                {/* Row 4: Status chip + indicator dots */}
                <div className="flex items-center justify-between mt-1.5 gap-1">
                    <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 font-medium border ${statusConfig.className}`}
                    >
                        {statusConfig.label}
                    </Badge>

                    <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={200}>
                            {hasBlockingConflict && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-0.5 bg-red-100 rounded-full px-1.5 py-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                            <span className="text-[9px] font-medium text-red-700">{conflictCount}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-medium">Blocking conflict{conflictCount > 1 ? 's' : ''}</p>
                                        {session.conflicts.slice(0, 3).map((c, i) => (
                                            <p key={i} className="text-xs text-slate-400">[{c.type}] {c.message}</p>
                                        ))}
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {!hasBlockingConflict && hasWarning && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-0.5 bg-amber-100 rounded-full px-1.5 py-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                            <span className="text-[9px] font-medium text-amber-700">{conflictCount}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="font-medium">Warning{conflictCount > 1 ? 's' : ''}</p>
                                        {session.conflicts.slice(0, 3).map((c, i) => (
                                            <p key={i} className="text-xs text-slate-400">[{c.type}] {c.message}</p>
                                        ))}
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {isSyncFailed && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-red-800" />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Sync Failed</p></TooltipContent>
                                </Tooltip>
                            )}

                            {isSyncPending && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Sync Pending</p></TooltipContent>
                                </Tooltip>
                            )}

                            {isSynced && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Synced to Wix</p></TooltipContent>
                                </Tooltip>
                            )}
                        </TooltipProvider>
                    </div>
                </div>
            </Card>
        );
    }
);
