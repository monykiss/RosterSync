"use client";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlannerGrid } from '@/components/planner/PlannerGrid';
import { SessionUI } from '@/components/planner/SessionCard';
import { SessionDrawer } from '@/components/planner/SessionDrawer';
import { PublishModal } from '@/components/planner/PublishModal';
import { ReadinessBar } from '@/components/planner/ReadinessBar';
import { BulkActionsTray } from '@/components/planner/BulkActionsTray';
import { PlannerSkeleton } from '@/components/planner/PlannerSkeleton';
import { KeyboardShortcutsHelp } from '@/components/planner/KeyboardShortcutsHelp';
import { VersionDiffPanel } from '@/components/planner/VersionDiffPanel';
import { usePlannerWeek, useBulkUpdateStatus, useRetryJob, SessionRecord, SessionConflict } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { useState, useCallback, useEffect } from 'react';
import { useStudio } from '@/lib/studio-context';
import { getTimezoneAbbr } from '@/lib/timezone';
import { toast } from '@/hooks/use-toast';

export default function PlannerPage({ params }: { params: { weekId: string } }) {
    const { data: weekData, isLoading, error } = usePlannerWeek(params.weekId);
    const { activeStudio, user } = useStudio();
    const bulkUpdateStatus = useBulkUpdateStatus();
    const retryJob = useRetryJob();
    const [selectedSession, setSelectedSession] = useState<SessionUI | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isPublishOpen, setIsPublishOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

    const handleToggleSelect = useCallback((sessionId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) next.delete(sessionId);
            else next.add(sessionId);
            return next;
        });
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleSelectAll = useCallback(() => {
        if (!weekData) return;
        setSelectedIds(new Set(weekData.sessions.map((s: SessionRecord) => s.id)));
    }, [weekData]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore when typing in inputs
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            switch (e.key) {
                case 'Escape':
                    if (isShortcutsOpen) setIsShortcutsOpen(false);
                    else if (isPublishOpen) setIsPublishOpen(false);
                    else if (isDrawerOpen) setIsDrawerOpen(false);
                    else if (selectedIds.size > 0) setSelectedIds(new Set());
                    break;
                case '?':
                    setIsShortcutsOpen(prev => !prev);
                    break;
                case 'p':
                case 'P':
                    if (!isDrawerOpen && !isPublishOpen && !isShortcutsOpen) {
                        e.preventDefault();
                        setIsPublishOpen(true);
                    }
                    break;
                case 'a':
                case 'A':
                    if (!isDrawerOpen && !isPublishOpen && !isShortcutsOpen) {
                        e.preventDefault();
                        handleSelectAll();
                    }
                    break;
                case 'd':
                case 'D':
                    if (!isDrawerOpen && !isPublishOpen && !isShortcutsOpen) {
                        e.preventDefault();
                        setSelectedIds(new Set());
                    }
                    break;
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isDrawerOpen, isPublishOpen, isShortcutsOpen, selectedIds.size, handleSelectAll]);

    if (isLoading) {
        return <PlannerSkeleton />;
    }

    if (error || !weekData) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8">
                <div className="text-center space-y-2">
                    <div className="text-red-500 font-semibold">Error loading planner</div>
                    <p className="text-sm text-slate-500">Check your connection and try refreshing.</p>
                </div>
            </div>
        );
    }

    const studioTz = weekData.studio?.timezone || activeStudio?.timezone;
    const tzAbbr = studioTz ? getTimezoneAbbr(studioTz) : null;

    const isDraft = weekData.status === 'DRAFT';
    const allConflicts: SessionConflict[] = weekData.conflicts || [];
    const criticalConflicts = allConflicts.filter(c => c.severity === 'CRITICAL');
    const warningCount = allConflicts.length - criticalConflicts.length;
    const needsCoverCount = weekData.sessions.filter((s: SessionRecord) => s.status === 'NEEDS_COVER').length;
    const syncFailureCount = weekData.sessions.filter((s: SessionRecord) => s.syncStatus?.status === 'FAILED').length;
    const studioName = weekData.studio?.name || 'Studio';

    const uiSessions: SessionUI[] = weekData.sessions.map((s: SessionRecord) => ({
        id: s.id,
        startDateTimeUTC: s.startDateTimeUTC,
        endDateTimeUTC: s.endDateTimeUTC,
        effectiveClassType: s.overrideClassType?.name || s.baseClassType?.name || 'Unknown Class',
        effectiveInstructor: s.overrideInstructor?.fullName || s.baseInstructor?.fullName || 'Unassigned',
        status: s.status,
        conflicts: allConflicts.filter(c => c.sessionId === s.id),
        syncStatus: s.syncStatus?.status || null,
        overrideReason: s.overrideReason || null,
    }));

    const selectedSessions = uiSessions.filter(s => selectedIds.has(s.id));

    const startDateStr = weekData.weekStartDate
        ? format(parseISO(weekData.weekStartDate), 'MMM d, yyyy')
        : 'Unknown Date';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        Week of {startDateStr}
                        <Badge variant={isDraft ? "secondary" : "default"} className="text-[10px]">
                            {isDraft ? 'DRAFT' : `PUBLISHED v${weekData.publishVersion}`}
                        </Badge>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {studioName}
                        {tzAbbr && <span className="ml-1.5 text-slate-400">({tzAbbr})</span>}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        {criticalConflicts.length > 0 && (
                            <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 text-[10px]">
                                Blocking: {criticalConflicts.length}
                            </Badge>
                        )}
                        {warningCount > 0 && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]">
                                Warnings: {warningCount}
                            </Badge>
                        )}
                    </div>
                    <button
                        onClick={() => setIsShortcutsOpen(true)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Keyboard shortcuts"
                        title="Keyboard shortcuts (?)"
                    >
                        <kbd className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 border border-slate-300 rounded text-xs font-mono">?</kbd>
                    </button>
                    <Button size="sm" onClick={() => setIsPublishOpen(true)}>
                        {isDraft ? 'Publish Week' : 'Republish'}
                    </Button>
                </div>
            </header>

            {/* Readiness Bar */}
            <ReadinessBar
                blockingConflicts={criticalConflicts.length}
                needsCover={needsCoverCount}
                syncFailures={syncFailureCount}
                totalSessions={uiSessions.length}
            />

            {/* Legend */}
            <div className="px-6 py-1.5 bg-slate-50 border-b flex gap-4 text-[10px] font-medium text-slate-400">
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" />Needs Cover</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />Conflict</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Override</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" />Pending</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />Synced</span>
            </div>

            {/* Grid + Diff Panel */}
            <main className="flex-1 overflow-auto p-4 bg-slate-50/50 space-y-3">
                {/* Version Diff Panel */}
                <VersionDiffPanel
                    weekId={weekData.id}
                    currentVersion={weekData.publishVersion}
                    isPublished={weekData.status === 'PUBLISHED'}
                    onHighlightSession={(sessionId) => {
                        const target = uiSessions.find(s => s.id === sessionId);
                        if (target) {
                            setSelectedSession(target);
                            setIsDrawerOpen(true);
                        }
                    }}
                />

                <PlannerGrid
                    sessions={uiSessions}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onSessionSelect={(session) => {
                        setSelectedSession(session);
                        setIsDrawerOpen(true);
                    }}
                    onMarkNeedsCover={(sessionId) => {
                        const studioId = activeStudio?.id;
                        if (!studioId) return;
                        bulkUpdateStatus.mutate(
                            { studioId, sessionIds: [sessionId], status: 'NEEDS_COVER' },
                            { onError: () => toast({ title: "Status Not Updated", variant: "destructive" }) },
                        );
                    }}
                />
            </main>

            {/* Drawer */}
            <SessionDrawer
                session={selectedSession}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            />

            {/* Publish Modal */}
            <PublishModal
                isOpen={isPublishOpen}
                onClose={() => setIsPublishOpen(false)}
                weekId={weekData.id}
                userRole={user?.role ?? 'SCHEDULER'}
                onFixSession={(sessionId) => {
                    const target = uiSessions.find(s => s.id === sessionId);
                    if (target) {
                        setSelectedSession(target);
                        setIsDrawerOpen(true);
                    }
                }}
            />

            {/* Keyboard Shortcuts Help */}
            <KeyboardShortcutsHelp
                isOpen={isShortcutsOpen}
                onClose={() => setIsShortcutsOpen(false)}
            />

            {/* Bulk Actions Tray */}
            <BulkActionsTray
                selectedSessions={selectedSessions}
                totalCount={uiSessions.length}
                onClearSelection={handleClearSelection}
                onSelectAll={handleSelectAll}
                onMarkNeedsCover={async () => {
                    const studioId = activeStudio?.id;
                    if (!studioId) return;
                    const eligible = selectedSessions
                        .filter(s => s.status === 'SCHEDULED')
                        .map(s => s.id);
                    if (eligible.length === 0) return;
                    try {
                        await bulkUpdateStatus.mutateAsync({ studioId, sessionIds: eligible, status: 'NEEDS_COVER' });
                        handleClearSelection();
                    } catch {
                        toast({ title: "Status Not Updated", variant: "destructive" });
                    }
                }}
                onCancelSessions={async () => {
                    const studioId = activeStudio?.id;
                    if (!studioId) return;
                    const cancellable = selectedSessions
                        .filter(s => s.status !== 'CANCELLED')
                        .map(s => s.id);
                    if (cancellable.length === 0) return;
                    try {
                        await bulkUpdateStatus.mutateAsync({ studioId, sessionIds: cancellable, status: 'CANCELLED' });
                        handleClearSelection();
                    } catch {
                        toast({ title: "Sessions Not Cancelled", variant: "destructive" });
                    }
                }}
                onRetrySync={async () => {
                    const failedSessions = weekData.sessions.filter(
                        (s: SessionRecord) => selectedIds.has(s.id) && s.syncStatus?.status === 'FAILED'
                    );
                    for (const s of failedSessions) {
                        if (s.syncStatus?.id) {
                            retryJob.mutate(s.syncStatus.id);
                        }
                    }
                    handleClearSelection();
                }}
            />
        </div>
    );
}
