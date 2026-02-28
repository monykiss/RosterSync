"use client";

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SessionUI } from "./SessionCard";
import { useSessionDetail, useRetryJob, useOverrideSession, useInstructors, useClassTypes } from "@/lib/api";
import { Loader2, ArrowRight, RefreshCcw, Clock, User, BookOpen, Zap, Pencil, ShieldCheck, ShieldAlert, BarChart3, AlertTriangle } from 'lucide-react';
import { useStudio } from '@/lib/studio-context';
import { formatInStudioTz } from '@/lib/timezone';

interface SessionDrawerProps {
    session: SessionUI | null;
    isOpen: boolean;
    onClose: () => void;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    'ASSIGN_INSTRUCTOR': { label: 'Instructor Assigned', icon: '👤', color: 'text-blue-700' },
    'OVERRIDE_SESSION': { label: 'Session Override', icon: '✏️', color: 'text-purple-700' },
    'UPDATE_STATUS': { label: 'Status Changed', icon: '🔄', color: 'text-slate-700' },
    'BULK_STATUS_UPDATE': { label: 'Bulk Status Update', icon: '📋', color: 'text-slate-600' },
    'COVER_ACCEPTED': { label: 'Cover Accepted', icon: '✅', color: 'text-green-700' },
    'COVER_CANCELLED': { label: 'Cover Cancelled', icon: '❌', color: 'text-red-700' },
    'COVER_ASSIGNED_WITH_COMPAT_OVERRIDE': { label: 'Cover + Compatibility Override', icon: '🔀', color: 'text-blue-700' },
    'PUBLISH_WEEK': { label: 'Week Published', icon: '📦', color: 'text-green-700' },
};

export function SessionDrawer({ session, isOpen, onClose }: SessionDrawerProps) {
    const { data: detail, isLoading } = useSessionDetail(isOpen ? session?.id ?? null : null);
    const retryMutation = useRetryJob();
    const overrideMutation = useOverrideSession();

    const { activeStudio } = useStudio();
    const tz = activeStudio?.timezone;
    const studioId = activeStudio?.id;

    const { data: instructors } = useInstructors(studioId);
    const { data: classTypes } = useClassTypes(studioId);

    const [showOverrideForm, setShowOverrideForm] = useState(false);
    const [overrideInstructorId, setOverrideInstructorId] = useState('');
    const [overrideClassTypeId, setOverrideClassTypeId] = useState('');
    const [overrideReason, setOverrideReason] = useState('');

    const handleApplyOverride = async () => {
        if (!session?.id || !overrideReason) return;
        await overrideMutation.mutateAsync({
            sessionId: session.id,
            instructorId: overrideInstructorId || undefined,
            classTypeId: overrideClassTypeId || undefined,
            reason: overrideReason,
        });
        setShowOverrideForm(false);
        setOverrideInstructorId('');
        setOverrideClassTypeId('');
        setOverrideReason('');
    };

    if (!session) return null;

    const startTime = formatInStudioTz(session.startDateTimeUTC, 'EEE, MMM d, yyyy h:mm a', tz);
    const endTime = formatInStudioTz(session.endDateTimeUTC, 'h:mm a', tz);

    const hasConflict = session.conflicts.length > 0;

    // Derive base vs effective from detail data
    const s = detail?.session;
    const hasOverride = s && (s.overrideInstructorId || s.overrideClassTypeId);

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-xl w-full overflow-y-auto bg-slate-50 p-0">
                {/* Header */}
                <div className="bg-white p-5 border-b">
                    <SheetHeader>
                        <SheetTitle className="text-xl font-bold flex items-center justify-between gap-2">
                            <span className="truncate">{session.effectiveClassType}</span>
                            <div className="flex gap-1.5 flex-shrink-0">
                                <Badge variant="outline" className="text-[10px]">{session.status}</Badge>
                                {session.syncStatus && (
                                    <Badge
                                        variant={session.syncStatus === 'SUCCEEDED' ? 'default' : session.syncStatus === 'FAILED' ? 'destructive' : 'secondary'}
                                        className="text-[10px]"
                                    >
                                        Sync: {session.syncStatus}
                                    </Badge>
                                )}
                            </div>
                        </SheetTitle>
                        <SheetDescription className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                            <span className="font-medium text-slate-700">{session.effectiveInstructor}</span>
                            <span className="text-slate-300">|</span>
                            <span>{startTime} – {endTime}</span>
                        </SheetDescription>
                    </SheetHeader>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Base vs Effective Comparison */}
                        {s && (
                            <section className="space-y-2">
                                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <BookOpen className="w-3 h-3" />
                                    Base vs Effective
                                </h3>
                                <div className="bg-white border rounded-md overflow-hidden">
                                    <div className="grid grid-cols-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 border-b">
                                        <div className="p-2.5" />
                                        <div className="p-2.5">Base (Template)</div>
                                        <div className="p-2.5">Effective (Live)</div>
                                    </div>
                                    <div className="divide-y">
                                        <ComparisonRow
                                            label="Class Type"
                                            base={s.baseClassType?.name}
                                            effective={s.overrideClassType?.name || s.baseClassType?.name}
                                            changed={!!s.overrideClassTypeId}
                                        />
                                        <ComparisonRow
                                            label="Instructor"
                                            base={s.baseInstructor?.fullName || 'Unassigned'}
                                            effective={s.overrideInstructor?.fullName || s.baseInstructor?.fullName || 'Unassigned'}
                                            changed={!!s.overrideInstructorId}
                                        />
                                        <ComparisonRow
                                            label="Status"
                                            base="SCHEDULED"
                                            effective={s.status}
                                            changed={s.status !== 'SCHEDULED'}
                                        />
                                    </div>
                                </div>

                                {/* Override Reason */}
                                {hasOverride && s.overrideReason && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex items-start gap-2">
                                        <Zap className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-medium text-blue-800">Why this session changed</p>
                                            <p className="text-xs text-blue-700 mt-0.5">{s.overrideReason}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Apply Override Button / Form */}
                                {!showOverrideForm ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs gap-1.5 w-full"
                                        onClick={() => setShowOverrideForm(true)}
                                    >
                                        <Pencil className="w-3 h-3" />
                                        Apply Override
                                    </Button>
                                ) : (
                                    <div className="bg-white border rounded-md p-3 space-y-3">
                                        <p className="text-xs font-semibold text-slate-700">Apply Override</p>
                                        <div>
                                            <label className="text-[10px] font-medium text-slate-500 uppercase">Instructor</label>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                value={overrideInstructorId}
                                                onChange={e => setOverrideInstructorId(e.target.value)}
                                            >
                                                <option value="">Keep current</option>
                                                {instructors?.map(inst => (
                                                    <option key={inst.id} value={inst.id}>{inst.fullName}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-medium text-slate-500 uppercase">Class Type</label>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                value={overrideClassTypeId}
                                                onChange={e => setOverrideClassTypeId(e.target.value)}
                                            >
                                                <option value="">Keep current</option>
                                                {classTypes?.map(ct => (
                                                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-medium text-slate-500 uppercase">Reason (required)</label>
                                            <Input
                                                className="h-8 text-xs"
                                                value={overrideReason}
                                                onChange={e => setOverrideReason(e.target.value)}
                                                placeholder="e.g. Instructor unavailable, class type change"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1 text-xs h-7"
                                                disabled={!overrideReason || overrideMutation.isPending}
                                                onClick={handleApplyOverride}
                                            >
                                                {overrideMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                                                Apply
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs h-7"
                                                onClick={() => setShowOverrideForm(false)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Derivation Chain (Explainability) */}
                        {detail?.explainability && (
                            <section className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Zap className="w-3 h-3" />
                                        Why This Assignment?
                                    </h3>
                                    <ConfidenceBadge score={detail.explainability.confidence} />
                                </div>

                                {/* Risk Flags */}
                                {detail.explainability.riskFlags.length > 0 && (
                                    <div className="space-y-1.5">
                                        {detail.explainability.riskFlags.map((flag, i) => (
                                            <div key={i} className={`border rounded-md p-2 flex items-start gap-2 ${
                                                flag.level === 'HIGH' ? 'bg-red-50 border-red-200' :
                                                flag.level === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
                                                'bg-blue-50 border-blue-200'
                                            }`}>
                                                <AlertTriangle className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                                                    flag.level === 'HIGH' ? 'text-red-500' :
                                                    flag.level === 'MEDIUM' ? 'text-amber-500' :
                                                    'text-blue-500'
                                                }`} />
                                                <div>
                                                    <p className={`text-[10px] font-medium ${
                                                        flag.level === 'HIGH' ? 'text-red-700' :
                                                        flag.level === 'MEDIUM' ? 'text-amber-700' :
                                                        'text-blue-700'
                                                    }`}>{flag.label}</p>
                                                    <p className="text-[9px] text-slate-500 mt-0.5">{flag.fix}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="bg-white border rounded-md p-3 space-y-0">
                                    {detail.explainability.steps.map((step: { layer: string; label: string; detail: string }, i: number) => (
                                        <div key={step.layer} className="flex items-start gap-2">
                                            <div className="flex flex-col items-center flex-shrink-0">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                                    step.layer === 'EFFECTIVE'
                                                        ? 'bg-blue-600 text-white'
                                                        : step.layer === 'OVERRIDE'
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : step.layer === 'COVER'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {i + 1}
                                                </div>
                                                {i < detail.explainability.steps.length - 1 && (
                                                    <div className="w-px h-4 bg-slate-200" />
                                                )}
                                            </div>
                                            <div className="pb-2">
                                                <p className="text-[10px] font-semibold text-slate-700">{step.label}</p>
                                                <p className="text-[10px] text-slate-500">{step.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Skill Qualification */}
                                {detail.explainability.skillMatch && (
                                    <div className={`border rounded-md p-2.5 flex items-start gap-2 ${
                                        detail.explainability.skillMatch.qualified
                                            ? 'bg-green-50 border-green-100'
                                            : 'bg-amber-50 border-amber-200'
                                    }`}>
                                        {detail.explainability.skillMatch.qualified
                                            ? <ShieldCheck className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                                            : <ShieldAlert className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        }
                                        <p className={`text-[10px] ${
                                            detail.explainability.skillMatch.qualified
                                                ? 'text-green-700' : 'text-amber-700'
                                        }`}>
                                            {detail.explainability.skillMatch.detail}
                                        </p>
                                    </div>
                                )}

                                {/* Weekly Load */}
                                {detail.explainability.weeklyLoad && (
                                    <div className="bg-white border rounded-md p-2.5 flex items-center gap-2">
                                        <BarChart3 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <div className="flex-1 text-[10px] text-slate-600">
                                            <span className="font-medium">Weekly load:</span>{' '}
                                            <span className={
                                                detail.explainability.weeklyLoad.max &&
                                                detail.explainability.weeklyLoad.current >= detail.explainability.weeklyLoad.max
                                                    ? 'text-red-600 font-semibold'
                                                    : ''
                                            }>
                                                {detail.explainability.weeklyLoad.current}
                                                {detail.explainability.weeklyLoad.max
                                                    ? ` / ${detail.explainability.weeklyLoad.max} slots`
                                                    : ' slots (no limit set)'}
                                            </span>
                                        </div>
                                        {detail.explainability.weeklyLoad.max && (
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        detail.explainability.weeklyLoad.current >= detail.explainability.weeklyLoad.max
                                                            ? 'bg-red-500' : 'bg-green-500'
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(100, (detail.explainability.weeklyLoad.current / detail.explainability.weeklyLoad.max) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Conflict Analysis */}
                        <section className="space-y-2">
                            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                Conflict Analysis
                            </h3>
                            {hasConflict ? (
                                <div className="bg-red-50 border border-red-100 rounded-md p-3 space-y-2">
                                    {session.conflicts.map((c, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${c.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                            <div>
                                                <p className="text-xs font-medium text-red-800">[{c.type}]</p>
                                                <p className="text-[11px] text-red-600">{c.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                                    <p className="text-xs text-green-800 font-medium">All constraints satisfied.</p>
                                </div>
                            )}
                        </section>

                        {/* Cover Opportunity Details */}
                        {s?.coverOpportunity && (
                            <section className="space-y-2">
                                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <User className="w-3 h-3" />
                                    Cover Opportunity
                                </h3>
                                <div className="bg-white border rounded-md p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Status</span>
                                        <Badge variant="outline" className="text-[10px]">{s.coverOpportunity.status}</Badge>
                                    </div>
                                    {s.coverOpportunity.offers.map((offer) => (
                                        <div key={offer.id} className="flex items-center justify-between text-xs border-t pt-2">
                                            <div>
                                                <span className="font-medium">{offer.instructor.fullName}</span>
                                                {offer.rankScore !== null && (
                                                    <span className="text-slate-400 ml-2">Score: {Math.round(offer.rankScore)}</span>
                                                )}
                                            </div>
                                            <Badge
                                                variant={offer.response === 'ACCEPT' ? 'default' : offer.response === 'DECLINE' ? 'destructive' : 'secondary'}
                                                className="text-[10px]"
                                            >
                                                {offer.response}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Audit Timeline */}
                        {detail?.auditTrail && detail.auditTrail.length > 0 && (
                            <section className="space-y-2">
                                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    Audit Timeline ({detail.auditTrail.length} events)
                                </h3>
                                <div className="bg-white border rounded-md divide-y">
                                    {detail.auditTrail.map((event) => {
                                        const actionConfig = ACTION_LABELS[event.action] || {
                                            label: event.action,
                                            icon: '📌',
                                            color: 'text-slate-700',
                                        };
                                        return (
                                            <div key={event.id} className="p-3 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs">{actionConfig.icon}</span>
                                                        <span className={`text-xs font-semibold ${actionConfig.color}`}>
                                                            {actionConfig.label}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {formatInStudioTz(event.createdAt, 'MMM d, HH:mm:ss', tz)}
                                                    </span>
                                                </div>
                                                {event.reason && (
                                                    <p className="text-[11px] text-slate-600">{event.reason}</p>
                                                )}
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <span>by {event.actor?.email || 'system'}</span>
                                                    {event.correlationId && (
                                                        <span className="font-mono">corr:{event.correlationId.slice(0, 8)}</span>
                                                    )}
                                                </div>
                                                {/* Before/After delta */}
                                                {(event.beforeJson || event.afterJson) && (
                                                    <div className="flex gap-2 mt-1">
                                                        {event.beforeJson && (
                                                            <div className="flex-1 bg-red-50 rounded p-1.5 text-[10px] font-mono text-red-700 overflow-hidden">
                                                                <span className="font-semibold">Before: </span>
                                                                {JSON.stringify(event.beforeJson)}
                                                            </div>
                                                        )}
                                                        {event.beforeJson && event.afterJson && (
                                                            <ArrowRight className="w-3 h-3 text-slate-300 mt-1 flex-shrink-0" />
                                                        )}
                                                        {event.afterJson && (
                                                            <div className="flex-1 bg-green-50 rounded p-1.5 text-[10px] font-mono text-green-700 overflow-hidden">
                                                                <span className="font-semibold">After: </span>
                                                                {JSON.stringify(event.afterJson)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Sync History */}
                        {detail?.syncHistory && detail.syncHistory.length > 0 && (
                            <section className="space-y-2">
                                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <RefreshCcw className="w-3 h-3" />
                                    Sync History
                                </h3>
                                <div className="bg-white border rounded-md divide-y">
                                    {detail.syncHistory.map((job) => (
                                        <div key={job.id} className="p-3 flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={job.status === 'SUCCEEDED' ? 'default' : job.status === 'FAILED' ? 'destructive' : 'secondary'}
                                                        className="text-[10px]"
                                                    >
                                                        {job.status}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {formatInStudioTz(job.createdAt, 'MMM d, HH:mm', tz)}
                                                    </span>
                                                </div>
                                                {job.lastError && (
                                                    <p className="text-[10px] text-red-600 font-mono truncate max-w-[280px]">
                                                        {job.lastError}
                                                    </p>
                                                )}
                                            </div>
                                            {job.status === 'FAILED' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-[10px] h-7"
                                                    disabled={retryMutation.isPending}
                                                    onClick={() => retryMutation.mutate(job.id)}
                                                >
                                                    Retry
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Payload Preview */}
                        <section className="space-y-2">
                            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                Sync Payload
                            </h3>
                            <div className="bg-slate-900 rounded-md p-3 text-slate-300 font-mono text-[10px] overflow-x-auto">
                                <pre className="whitespace-pre-wrap">
                                    {JSON.stringify({
                                        sessionId: session.id,
                                        startTime: session.startDateTimeUTC,
                                        endTime: session.endDateTimeUTC,
                                        classTypeName: session.effectiveClassType,
                                        instructorName: session.effectiveInstructor,
                                        status: session.status,
                                    }, null, 2)}
                                </pre>
                            </div>
                        </section>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

function ComparisonRow({
    label,
    base,
    effective,
    changed,
}: {
    label: string;
    base: string;
    effective: string;
    changed: boolean;
}) {
    return (
        <div className="grid grid-cols-3 text-xs">
            <div className="p-2.5 text-slate-500 font-medium">{label}</div>
            <div className={`p-2.5 ${changed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {base}
            </div>
            <div className={`p-2.5 font-medium ${changed ? 'text-blue-700 bg-blue-50/50' : 'text-slate-700'}`}>
                {effective}
                {changed && <span className="ml-1 text-[9px] text-blue-500">(override)</span>}
            </div>
        </div>
    );
}

function ConfidenceBadge({ score }: { score: number }) {
    const color = score >= 80 ? 'bg-green-100 text-green-700 border-green-200'
        : score >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200';

    const label = score >= 80 ? 'High' : score >= 50 ? 'Medium' : 'Low';

    return (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${color}`}>
            <div className="relative w-3 h-3">
                <svg viewBox="0 0 36 36" className="w-3 h-3 -rotate-90">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <circle
                        cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                        strokeDasharray={`${score} ${100 - score}`}
                        strokeLinecap="round"
                    />
                </svg>
            </div>
            {score}% {label}
        </div>
    );
}
