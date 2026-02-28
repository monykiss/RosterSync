"use client";

import { AlertTriangle, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';

interface ReadinessBarProps {
    blockingConflicts: number;
    needsCover: number;
    syncFailures: number;
    totalSessions: number;
}

export function ReadinessBar({ blockingConflicts, needsCover, syncFailures, totalSessions }: ReadinessBarProps) {
    const isReady = blockingConflicts === 0 && needsCover === 0;
    const hasIssues = blockingConflicts > 0 || needsCover > 0 || syncFailures > 0;

    return (
        <div className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-medium ${
            isReady ? 'bg-green-50/80' : 'bg-amber-50/80'
        }`}>
            <div className="flex items-center gap-5">
                {blockingConflicts > 0 && (
                    <div className="flex items-center gap-1.5 text-red-700">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Blocking: {blockingConflicts}</span>
                    </div>
                )}
                {needsCover > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Needs Cover: {needsCover}</span>
                    </div>
                )}
                {syncFailures > 0 && (
                    <div className="flex items-center gap-1.5 text-red-600">
                        <RefreshCcw className="w-3.5 h-3.5" />
                        <span>Sync Failures: {syncFailures}</span>
                    </div>
                )}
                {!hasIssues && (
                    <div className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{totalSessions} sessions — all constraints satisfied</span>
                    </div>
                )}
            </div>

            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                isReady
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
            }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-red-500'}`} />
                {isReady ? 'READY TO PUBLISH' : 'NOT READY'}
            </div>
        </div>
    );
}
