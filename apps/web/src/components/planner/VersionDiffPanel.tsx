"use client";

import { useVersionHistory, useVersionDiff, VersionSnapshot } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { GitCompareArrows, Plus, Minus, Pencil, Check } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';

interface VersionDiffPanelProps {
    weekId: string;
    currentVersion: number;
    isPublished: boolean;
    onHighlightSession?: (sessionId: string, changeType: string) => void;
}

const CHANGE_ICONS = {
    added: <Plus className="w-3.5 h-3.5 text-green-600" />,
    removed: <Minus className="w-3.5 h-3.5 text-red-600" />,
    modified: <Pencil className="w-3.5 h-3.5 text-amber-600" />,
    unchanged: <Check className="w-3.5 h-3.5 text-slate-400" />,
};

const CHANGE_COLORS = {
    added: 'bg-green-50 border-green-200 text-green-800',
    removed: 'bg-red-50 border-red-200 text-red-800',
    modified: 'bg-amber-50 border-amber-200 text-amber-800',
    unchanged: 'bg-slate-50 border-slate-200 text-slate-500',
};

export function VersionDiffPanel({
    weekId,
    currentVersion,
    isPublished,
    onHighlightSession,
}: VersionDiffPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(currentVersion);

    const { data: versions } = useVersionHistory(weekId, isOpen);
    const { data: diff, isLoading: diffLoading } = useVersionDiff(
        weekId,
        selectedVersion,
        isOpen && selectedVersion > 0,
    );

    if (!isPublished || currentVersion < 1) return null;

    return (
        <div className="bg-white border rounded-lg shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors rounded-lg"
            >
                <div className="flex items-center gap-2">
                    <GitCompareArrows className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                        Changes since v{currentVersion}
                    </span>
                </div>
                <span className="text-xs text-slate-400">
                    {isOpen ? 'Hide' : 'Show'}
                </span>
            </button>

            {isOpen && (
                <div className="border-t px-4 py-3 space-y-3">
                    {/* Version Selector */}
                    {versions && versions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Compare against:</span>
                            <div className="flex gap-1">
                                {versions.map((v: VersionSnapshot) => (
                                    <Button
                                        key={v.publishVersion}
                                        size="sm"
                                        variant={selectedVersion === v.publishVersion ? 'default' : 'outline'}
                                        className="text-xs h-6 px-2"
                                        onClick={() => setSelectedVersion(v.publishVersion)}
                                    >
                                        v{v.publishVersion}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Diff Summary */}
                    {diffLoading && (
                        <div className="text-xs text-slate-400 py-2">Computing diff...</div>
                    )}

                    {diff && !diffLoading && (
                        <>
                            <div className="grid grid-cols-4 gap-2">
                                <DiffStat label="Added" count={diff.added} color="green" />
                                <DiffStat label="Removed" count={diff.removed} color="red" />
                                <DiffStat label="Modified" count={diff.modified} color="amber" />
                                <DiffStat label="Unchanged" count={diff.unchanged} color="slate" />
                            </div>

                            {diff.added === 0 && diff.removed === 0 && diff.modified === 0 && (
                                <p className="text-xs text-slate-500 text-center py-1">
                                    No changes since v{selectedVersion}
                                </p>
                            )}

                            {/* Changed Sessions List */}
                            {diff.changes.filter(c => c.changeType !== 'unchanged').length > 0 && (
                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                    {diff.changes
                                        .filter(c => c.changeType !== 'unchanged')
                                        .map(change => (
                                            <button
                                                key={change.sessionId}
                                                onClick={() => onHighlightSession?.(change.sessionId, change.changeType)}
                                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-left text-xs ${CHANGE_COLORS[change.changeType]} hover:opacity-80 transition-opacity`}
                                            >
                                                {CHANGE_ICONS[change.changeType]}
                                                <span className="font-mono truncate flex-1">{change.sessionId.slice(0, 8)}...</span>
                                                {change.fields && (
                                                    <span className="text-[10px] opacity-70">
                                                        {change.fields.join(', ')}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                </div>
                            )}

                            {/* Published At */}
                            <div className="text-[10px] text-slate-400 pt-1 border-t">
                                v{diff.publishVersion} published {format(parseISO(diff.publishedAt), 'MMM d, h:mm a')}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function DiffStat({ label, count, color }: { label: string; count: number; color: string }) {
    const colorMap: Record<string, string> = {
        green: 'text-green-700 bg-green-50',
        red: 'text-red-700 bg-red-50',
        amber: 'text-amber-700 bg-amber-50',
        slate: 'text-slate-600 bg-slate-50',
    };

    return (
        <div className={`text-center rounded px-2 py-1.5 ${colorMap[color]}`}>
            <div className="text-lg font-bold">{count}</div>
            <div className="text-[10px] font-medium">{label}</div>
        </div>
    );
}
