"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePrepublishCheck, usePublishWeek, BlockerGroup } from "@/lib/api";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Zap, ExternalLink, ShieldAlert } from "lucide-react";

interface PublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    weekId: string;
    userRole: string;
    onFixSession?: (sessionId: string) => void;
}

type WizardStep = 'preflight' | 'confirm' | 'force-confirm' | 'result';

const FORCE_CONFIRM_TEXT = 'FORCE PUBLISH';

export function PublishModal({ isOpen, onClose, weekId, userRole, onFixSession }: PublishModalProps) {
    const { data: precheck, isLoading: precheckLoading } = usePrepublishCheck(weekId, isOpen);
    const publishMutation = usePublishWeek();
    const [step, setStep] = useState<WizardStep>('preflight');
    const [forceInput, setForceInput] = useState('');
    const [wasForced, setWasForced] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('preflight');
            setForceInput('');
            setWasForced(false);
            publishMutation.reset();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const canPublish = precheck?.canPublish ?? false;
    const isAdmin = userRole === 'ADMIN';
    const canForcePublish = isAdmin && !canPublish && (precheck?.criticalCount ?? 0) > 0;

    const handlePublish = (force = false) => {
        setWasForced(force);
        publishMutation.mutate({ weekId, force }, {
            onSuccess: () => setStep('result'),
        });
    };

    const handleClose = () => {
        setStep('preflight');
        setForceInput('');
        setWasForced(false);
        publishMutation.reset();
        onClose();
    };

    const handleFixSession = (sessionId: string) => {
        handleClose();
        onFixSession?.(sessionId);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                {/* Step 1: Preflight */}
                {step === 'preflight' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <Zap className="w-5 h-5 text-slate-500" />
                                Publish Preflight
                            </DialogTitle>
                            <DialogDescription>
                                Review all constraints before creating an immutable publish snapshot.
                            </DialogDescription>
                        </DialogHeader>

                        {precheckLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-sm text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Running preflight checks...
                            </div>
                        ) : precheck ? (
                            <div className="space-y-4 py-3">
                                {/* Summary Metrics */}
                                <div className="grid grid-cols-3 gap-3">
                                    <MetricCard label="Sessions" value={precheck.sessionCount} />
                                    <MetricCard label="Blockers" value={precheck.criticalCount} className={precheck.criticalCount > 0 ? 'text-red-700' : 'text-green-700'} />
                                    <MetricCard
                                        label="Status"
                                        value={canPublish ? 'READY' : 'BLOCKED'}
                                        className={canPublish ? 'text-green-700' : 'text-red-700'}
                                    />
                                </div>

                                {/* Critical Blockers with Fix Buttons */}
                                {precheck.blockers.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-red-700 flex items-center gap-1">
                                            <XCircle className="w-3.5 h-3.5" />
                                            Blocking Issues ({precheck.criticalCount})
                                        </h4>
                                        {precheck.blockers.map((group) => (
                                            <BlockerCard
                                                key={group.type}
                                                group={group}
                                                onFix={onFixSession ? handleFixSession : undefined}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Warnings */}
                                {precheck.warnings.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-md p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                            <span className="text-xs font-semibold text-amber-800">
                                                Warnings ({precheck.warningCount})
                                            </span>
                                        </div>
                                        {precheck.warnings.map((w) => (
                                            <div key={w.type} className="mt-1">
                                                <p className="text-[11px] text-amber-700 font-medium">{w.label} ({w.count})</p>
                                                <p className="text-[10px] text-amber-600">{w.fixHint}</p>
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-amber-500 mt-1.5">Warnings do not block publish.</p>
                                    </div>
                                )}

                                {/* All Clear */}
                                {canPublish && precheck.warningCount === 0 && (
                                    <div className="bg-green-50 border border-green-100 rounded-md p-3 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        <p className="text-xs text-green-800 font-medium">
                                            All constraints satisfied. Ready to publish.
                                        </p>
                                    </div>
                                )}

                                {precheck.isRepublish && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                                        <p className="text-xs text-blue-800">
                                            Currently at v{precheck.publishVersion}. This will create a new version.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <DialogFooter className="gap-2 sm:justify-between">
                            <div className="flex gap-2">
                                {canForcePublish && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 text-xs"
                                        onClick={() => setStep('force-confirm')}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        Force Publish
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                <Button
                                    onClick={() => setStep('confirm')}
                                    disabled={!canPublish || precheckLoading}
                                    className="gap-1.5"
                                >
                                    Continue
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}

                {/* Step 2: Confirm (safe publish) */}
                {step === 'confirm' && precheck && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-lg">Confirm Publish</DialogTitle>
                            <DialogDescription>
                                This creates an immutable snapshot and enqueues Wix sync jobs for all sessions.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-3">
                            <div className="bg-slate-50 border rounded-md p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Sessions to sync</span>
                                    <span className="font-semibold">{precheck.sessionCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Sync jobs created</span>
                                    <span className="font-semibold">{precheck.sessionCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Warnings (non-blocking)</span>
                                    <span className="font-semibold text-amber-700">{precheck.warningCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Snapshot</span>
                                    <span className="font-mono text-xs text-slate-500">SHA-256 weekHash</span>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                <p className="text-xs text-amber-800 font-medium">
                                    This action is irreversible. The publish snapshot becomes the source of truth.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setStep('preflight')}>Back</Button>
                            <Button
                                onClick={() => handlePublish(false)}
                                disabled={publishMutation.isPending}
                            >
                                {publishMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
                                ) : (
                                    `Publish ${precheck.sessionCount} Sessions`
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* Step 2b: Force Publish Confirmation (admin only) */}
                {step === 'force-confirm' && precheck && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2 text-red-700">
                                <ShieldAlert className="w-5 h-5" />
                                Force Publish
                            </DialogTitle>
                            <DialogDescription>
                                You are overriding {precheck.criticalCount} blocking issue{precheck.criticalCount !== 1 ? 's' : ''}. This will publish the week despite unresolved conflicts.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-3">
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-2 text-sm">
                                <p className="text-red-800 font-medium text-xs">Overridden blockers:</p>
                                {precheck.blockers.map((b) => (
                                    <div key={b.type} className="flex justify-between text-xs">
                                        <span className="text-red-700">{b.label}</span>
                                        <Badge variant="destructive" className="text-[10px]">{b.count}</Badge>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-2">
                                <p className="text-xs text-red-800 font-medium">
                                    Type &ldquo;{FORCE_CONFIRM_TEXT}&rdquo; to confirm:
                                </p>
                                <Input
                                    value={forceInput}
                                    onChange={(e) => setForceInput(e.target.value.toUpperCase())}
                                    placeholder={FORCE_CONFIRM_TEXT}
                                    className="font-mono text-sm border-red-200 focus-visible:ring-red-400"
                                />
                            </div>

                            <p className="text-[10px] text-slate-500">
                                This will be logged in the audit trail as a force publish with your credentials.
                            </p>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => { setStep('preflight'); setForceInput(''); }}>Back</Button>
                            <Button
                                variant="destructive"
                                onClick={() => handlePublish(true)}
                                disabled={forceInput !== FORCE_CONFIRM_TEXT || publishMutation.isPending}
                            >
                                {publishMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Force Publishing...</>
                                ) : (
                                    `Force Publish ${precheck.sessionCount} Sessions`
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* Step 3: Result */}
                {step === 'result' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                Published Successfully
                            </DialogTitle>
                        </DialogHeader>

                        <div className="py-4 space-y-3">
                            <div className="bg-green-50 border border-green-100 rounded-md p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-700">Snapshot created</span>
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-green-700">Sync jobs queued</span>
                                    <span className="font-semibold text-green-800">{precheck?.sessionCount ?? '?'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-green-700">Version</span>
                                    <span className="font-mono text-xs">
                                        v{(publishMutation.data as Record<string, number>)?.publishVersion ?? '?'}
                                    </span>
                                </div>
                            </div>

                            {wasForced && (
                                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                                    <p className="text-xs text-amber-800">
                                        Published with force override. Blockers were recorded in the audit log.
                                    </p>
                                </div>
                            )}

                            <p className="text-xs text-slate-500">
                                Sync jobs are now processing. Check the Sync Dashboard for progress.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button onClick={handleClose}>Done</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function MetricCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
    return (
        <div className="bg-slate-50 border rounded-md p-2.5 text-center">
            <div className={`text-xl font-bold ${className || 'text-slate-900'}`}>{value}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
        </div>
    );
}

function BlockerCard({ group, onFix }: { group: BlockerGroup; onFix?: (sessionId: string) => void }) {
    return (
        <div className="bg-red-50 border border-red-100 rounded-md p-3">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-red-800">{group.label}</span>
                <Badge variant="destructive" className="text-[10px]">{group.count}</Badge>
            </div>
            <p className="text-[11px] text-red-600 mb-1.5">{group.description}</p>
            <p className="text-[10px] text-red-500 italic mb-2">{group.fixHint}</p>
            <ul className="space-y-1">
                {group.examples.map((example, i) => (
                    <li key={i} className="flex items-center justify-between text-[10px] text-red-700">
                        <span className="font-mono truncate mr-2">{example}</span>
                        {onFix && group.sessionIds[i] && (
                            <button
                                onClick={() => onFix(group.sessionIds[i])}
                                className="flex items-center gap-0.5 text-red-600 hover:text-red-800 underline underline-offset-2 shrink-0"
                            >
                                Fix now <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </li>
                ))}
                {group.count > group.examples.length && (
                    <li className="text-[10px] text-red-500">+{group.count - group.examples.length} more</li>
                )}
            </ul>
        </div>
    );
}
