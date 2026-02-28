"use client";

import { useMemo, useRef, useCallback } from 'react';
import { SessionUI, SessionCard, QuickAction } from './SessionCard';
import { parseISO, format } from 'date-fns';
import { CalendarPlus, ArrowRight, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PlannerGridProps {
    sessions: SessionUI[];
    onSessionSelect: (session: SessionUI) => void;
    selectedIds: Set<string>;
    onToggleSelect: (sessionId: string) => void;
    onMarkNeedsCover?: (sessionId: string) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type DayHealth = 'clear' | 'warning' | 'critical' | 'empty';

function computeDayHealth(sessions: SessionUI[]): DayHealth {
    if (sessions.length === 0) return 'empty';
    const hasCritical = sessions.some(s => s.conflicts.some(c => c.severity === 'CRITICAL'));
    if (hasCritical) return 'critical';
    const hasWarning = sessions.some(s => s.conflicts.some(c => c.severity === 'WARNING'));
    if (hasWarning) return 'warning';
    return 'clear';
}

const HEALTH_COLORS: Record<DayHealth, string> = {
    clear: 'bg-green-400',
    warning: 'bg-amber-400',
    critical: 'bg-red-500',
    empty: 'bg-slate-200',
};

interface NextAction {
    icon: React.ReactNode;
    message: string;
    actionLabel?: string;
    sessionId?: string;
}

function computeNextAction(sessions: SessionUI[]): NextAction | null {
    // Priority 1: Unassigned sessions
    const unassigned = sessions.find(s =>
        s.effectiveInstructor === 'Unassigned' && s.status !== 'CANCELLED'
    );
    if (unassigned) {
        return {
            icon: <ShieldAlert className="w-4 h-4 text-red-500" />,
            message: `${unassigned.effectiveClassType} has no instructor assigned`,
            actionLabel: 'Assign now',
            sessionId: unassigned.id,
        };
    }

    // Priority 2: Blocking conflicts
    const blocked = sessions.find(s =>
        s.conflicts.some(c => c.severity === 'CRITICAL') && s.status !== 'CANCELLED'
    );
    if (blocked) {
        const conflict = blocked.conflicts.find(c => c.severity === 'CRITICAL');
        return {
            icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
            message: `${blocked.effectiveClassType}: ${conflict?.message ?? 'has a blocking conflict'}`,
            actionLabel: 'Fix now',
            sessionId: blocked.id,
        };
    }

    // Priority 3: Needs cover
    const needsCover = sessions.find(s => s.status === 'NEEDS_COVER');
    if (needsCover) {
        return {
            icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
            message: `${needsCover.effectiveClassType} needs a cover instructor`,
            actionLabel: 'View',
            sessionId: needsCover.id,
        };
    }

    // Priority 4: Sync failures
    const syncFailed = sessions.find(s => s.syncStatus === 'FAILED');
    if (syncFailed) {
        return {
            icon: <RefreshCw className="w-4 h-4 text-red-500" />,
            message: `${syncFailed.effectiveClassType} sync to Wix failed`,
            actionLabel: 'Review',
            sessionId: syncFailed.id,
        };
    }

    return null;
}

export function PlannerGrid({ sessions, onSessionSelect, selectedIds, onToggleSelect, onMarkNeedsCover }: PlannerGridProps) {
    const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Flatten all sessions into a sorted array for keyboard navigation
    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) =>
            a.startDateTimeUTC.localeCompare(b.startDateTimeUTC)
        );
    }, [sessions]);

    const handleKeyNavigation = useCallback((e: React.KeyboardEvent, currentSession: SessionUI) => {
        const currentIdx = sortedSessions.findIndex(s => s.id === currentSession.id);
        if (currentIdx === -1) return;

        let nextIdx = -1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            nextIdx = Math.min(currentIdx + 1, sortedSessions.length - 1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            nextIdx = Math.max(currentIdx - 1, 0);
        }

        if (nextIdx >= 0 && nextIdx !== currentIdx) {
            e.preventDefault();
            const nextSession = sortedSessions[nextIdx];
            const nextRef = cellRefs.current.get(nextSession.id);
            nextRef?.focus();
        }
    }, [sortedSessions]);

    // Group sessions into a grid: rows = time slots, cols = day of week
    const { timeSlots, grid, daySessionsMap } = useMemo(() => {
        const byDay = new Map<number, SessionUI[]>();
        for (const s of sessions) {
            const dt = parseISO(s.startDateTimeUTC);
            const jsDay = dt.getUTCDay();
            const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
            if (!byDay.has(dayIdx)) byDay.set(dayIdx, []);
            byDay.get(dayIdx)!.push(s);
        }

        const slotSet = new Set<string>();
        for (const s of sessions) {
            const dt = parseISO(s.startDateTimeUTC);
            slotSet.add(format(dt, 'HH:mm'));
        }
        const sortedSlots = Array.from(slotSet).sort();

        const finalSlots = sortedSlots.length > 0
            ? sortedSlots
            : ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00'];

        const gridData: (SessionUI[])[][] = finalSlots.map(slot => {
            return DAY_LABELS.map((_, dayIdx) => {
                const daySessions = byDay.get(dayIdx) || [];
                return daySessions.filter(s => {
                    const dt = parseISO(s.startDateTimeUTC);
                    return format(dt, 'HH:mm') === slot;
                });
            });
        });

        return { timeSlots: finalSlots, grid: gridData, daySessionsMap: byDay };
    }, [sessions]);

    // Compute per-day health
    const dayHealthStripes = useMemo(() => {
        return DAY_LABELS.map((_, dayIdx) => {
            const daySessions = daySessionsMap.get(dayIdx) ?? [];
            return computeDayHealth(daySessions);
        });
    }, [daySessionsMap]);

    // Compute next best action
    const nextAction = useMemo(() => computeNextAction(sessions), [sessions]);

    // Build quick actions for a session
    const buildQuickActions = useCallback((session: SessionUI): QuickAction[] => {
        return [
            {
                label: 'Open Details',
                onClick: () => onSessionSelect(session),
                show: true,
            },
            {
                label: 'Mark Needs Cover',
                onClick: () => onMarkNeedsCover?.(session.id),
                show: !!onMarkNeedsCover && session.status === 'SCHEDULED',
            },
        ];
    }, [onSessionSelect, onMarkNeedsCover]);

    if (sessions.length === 0) {
        return (
            <div className="w-full bg-white rounded-lg border shadow-sm">
                <div className="p-12 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <CalendarPlus className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 text-lg">No sessions this week</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm">
                            Generate sessions from your recurring slot templates to populate the planner grid.
                        </p>
                    </div>
                    <Link href="/app/slots">
                        <Button variant="outline" className="mt-2">
                            Set Up Slot Templates
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Next Best Action Banner */}
            {nextAction && (
                <div className="bg-white border rounded-lg shadow-sm px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        {nextAction.icon}
                        <span className="text-sm text-slate-700">{nextAction.message}</span>
                    </div>
                    {nextAction.actionLabel && nextAction.sessionId && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs h-7"
                            onClick={() => {
                                const target = sessions.find(s => s.id === nextAction.sessionId);
                                if (target) onSessionSelect(target);
                            }}
                        >
                            {nextAction.actionLabel}
                            <ArrowRight className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            )}

            {/* Grid */}
            <div className="w-full overflow-x-auto bg-white rounded-lg border shadow-sm">
                <div className="min-w-[800px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-[80px_repeat(7,_1fr)] border-b bg-slate-50 sticky top-0 z-10">
                        <div className="p-2.5 font-semibold text-[10px] text-slate-400 uppercase tracking-widest border-r text-center">
                            Time
                        </div>
                        {DAY_LABELS.map((day, dayIdx) => (
                            <div key={day} className="border-r last:border-0">
                                <div className="p-2.5 font-semibold text-xs text-center text-slate-700">
                                    {day}
                                </div>
                                {/* Health Stripe */}
                                <div className={`h-1 ${HEALTH_COLORS[dayHealthStripes[dayIdx]]}`} />
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    {timeSlots.map((slot, slotIdx) => (
                        <div key={slot} className="grid grid-cols-[80px_repeat(7,_1fr)] border-b last:border-0">
                            <div className="p-2.5 border-r flex items-start justify-center bg-slate-50/80">
                                <span className="text-xs font-mono font-medium text-slate-500">{slot}</span>
                            </div>

                            {DAY_LABELS.map((_, dayIdx) => {
                                const cellSessions = grid[slotIdx]?.[dayIdx] || [];
                                return (
                                    <div
                                        key={dayIdx}
                                        className={`p-1.5 border-r last:border-0 min-h-[90px] space-y-1.5 ${
                                            cellSessions.length === 0 ? 'bg-slate-50/30' : ''
                                        }`}
                                    >
                                        {cellSessions.map(s => (
                                            <SessionCard
                                                key={s.id}
                                                ref={(el) => {
                                                    if (el) cellRefs.current.set(s.id, el);
                                                    else cellRefs.current.delete(s.id);
                                                }}
                                                session={s}
                                                onClick={() => onSessionSelect(s)}
                                                isSelected={selectedIds.has(s.id)}
                                                onSelect={() => onToggleSelect(s.id)}
                                                onKeyDown={(e) => handleKeyNavigation(e, s)}
                                                quickActions={buildQuickActions(s)}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
