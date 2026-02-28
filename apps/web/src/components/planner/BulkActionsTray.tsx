"use client";

import { Button } from '@/components/ui/button';
import { X, AlertTriangle, RefreshCcw, Ban, CheckSquare, Square } from 'lucide-react';
import { SessionUI } from './SessionCard';
import { useState } from 'react';

interface BulkActionsTrayProps {
    selectedSessions: SessionUI[];
    totalCount: number;
    onClearSelection: () => void;
    onSelectAll: () => void;
    onMarkNeedsCover: () => void;
    onCancelSessions: () => void;
    onRetrySync: () => void;
}

export function BulkActionsTray({
    selectedSessions,
    totalCount,
    onClearSelection,
    onSelectAll,
    onMarkNeedsCover,
    onCancelSessions,
    onRetrySync,
}: BulkActionsTrayProps) {
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    if (selectedSessions.length === 0) return null;

    const failedSyncCount = selectedSessions.filter(s => s.syncStatus === 'FAILED').length;
    const cancellableCount = selectedSessions.filter(
        s => s.status !== 'CANCELLED'
    ).length;
    const needsCoverEligible = selectedSessions.filter(
        s => s.status === 'SCHEDULED'
    ).length;
    const allSelected = selectedSessions.length === totalCount;

    return (
        <div className="fixed bottom-0 left-64 right-0 z-50 bg-white border-t shadow-lg">
            <div className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm font-semibold">
                        {selectedSessions.length} of {totalCount} selected
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1.5 text-slate-600"
                        onClick={allSelected ? onClearSelection : onSelectAll}
                    >
                        {allSelected ? (
                            <><Square className="w-3.5 h-3.5" /> Deselect All</>
                        ) : (
                            <><CheckSquare className="w-3.5 h-3.5" /> Select All</>
                        )}
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5"
                        disabled={needsCoverEligible === 0}
                        onClick={onMarkNeedsCover}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Mark Needs Cover
                        {needsCoverEligible > 0 && (
                            <span className="ml-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5">
                                {needsCoverEligible}
                            </span>
                        )}
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5"
                        disabled={failedSyncCount === 0}
                        onClick={onRetrySync}
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Retry Sync
                        {failedSyncCount > 0 && (
                            <span className="ml-0.5 text-[10px] bg-red-100 text-red-700 rounded-full px-1.5">
                                {failedSyncCount}
                            </span>
                        )}
                    </Button>

                    {!confirmingCancel ? (
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            disabled={cancellableCount === 0}
                            onClick={() => setConfirmingCancel(true)}
                        >
                            <Ban className="w-3.5 h-3.5" />
                            Cancel Sessions
                            {cancellableCount > 0 && (
                                <span className="ml-0.5 text-[10px] bg-red-100 text-red-700 rounded-full px-1.5">
                                    {cancellableCount}
                                </span>
                            )}
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                            <span className="text-xs text-red-700 font-medium">
                                Cancel {cancellableCount} session{cancellableCount !== 1 ? 's' : ''}?
                            </span>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs h-6 px-2"
                                onClick={() => {
                                    setConfirmingCancel(false);
                                    onCancelSessions();
                                }}
                            >
                                Confirm
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6 px-2"
                                onClick={() => setConfirmingCancel(false)}
                            >
                                No
                            </Button>
                        </div>
                    )}

                    <div className="w-px h-6 bg-slate-200 mx-1" />

                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1.5 text-slate-500"
                        onClick={() => {
                            setConfirmingCancel(false);
                            onClearSelection();
                        }}
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear
                    </Button>
                </div>
            </div>
        </div>
    );
}
