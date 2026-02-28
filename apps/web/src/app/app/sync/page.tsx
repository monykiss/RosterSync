"use client";

import { Activity, RefreshCcw, AlertTriangle, Search, Zap, Info, Wifi, WifiOff, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSyncDashboard, useRetryJob, useQueueHealth, SyncJob } from '@/lib/api';
import { useMemo, useState } from 'react';
import { useStudio } from '@/lib/studio-context';
import { formatInStudioTz } from '@/lib/timezone';

type StatusFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

interface ErrorGroup {
    pattern: string;
    count: number;
    jobIds: string[];
}

function groupErrors(jobs: SyncJob[]): ErrorGroup[] {
    const failedJobs = jobs.filter(j => j.status === 'FAILED' && j.lastError);
    const groups = new Map<string, ErrorGroup>();

    for (const job of failedJobs) {
        // Normalize error messages by removing dynamic parts (IDs, timestamps)
        const pattern = (job.lastError ?? '')
            .replace(/[0-9a-f]{8,}/gi, '<id>')
            .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<time>')
            .slice(0, 80);

        const key = pattern || 'Unknown error';
        const existing = groups.get(key);
        if (existing) {
            existing.count++;
            existing.jobIds.push(job.id);
        } else {
            groups.set(key, { pattern: key, count: 1, jobIds: [job.id] });
        }
    }

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export default function SyncPage() {
    const { activeStudio } = useStudio();
    const { data: syncJobs, isLoading } = useSyncDashboard(activeStudio?.id);
    const { data: queueHealth } = useQueueHealth();
    const retryMutation = useRetryJob();

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState("");

    const jobs: SyncJob[] = useMemo(() => syncJobs || [], [syncJobs]);
    const pendingCount = jobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').length;
    const failedCount = jobs.filter(j => j.status === 'FAILED').length;
    const succeededCount = jobs.filter(j => j.status === 'SUCCEEDED').length;
    const totalCount = jobs.length;

    // Compute success rate
    const finishedCount = succeededCount + failedCount;
    const successRate = finishedCount > 0 ? Math.round((succeededCount / finishedCount) * 100) : 100;

    // Group error patterns
    const errorGroups = useMemo(() => groupErrors(jobs), [jobs]);

    const filteredJobs = jobs.filter(j => {
        if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                j.id.toLowerCase().includes(q) ||
                (j.correlationId ?? '').toLowerCase().includes(q) ||
                (j.sessionId ?? '').toLowerCase().includes(q) ||
                (j.payloadHash ?? '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const failedJobs = filteredJobs.filter(j => j.status === 'FAILED');

    const handleRetryAllFailed = () => {
        for (const job of failedJobs) {
            retryMutation.mutate(job.id);
        }
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            {/* STUB Mode Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                    <span className="font-semibold">STUB MODE</span> — No real Wix API calls are being made. Sync jobs are simulated locally.
                    Switch to <code className="bg-amber-100 px-1 rounded text-[10px]">WIX_MODE=LIVE</code> for production.
                </p>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    Sync Dashboard
                </h2>
                <div className="flex items-center gap-3">
                    {failedCount > 0 && (
                        <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs gap-1.5"
                            disabled={retryMutation.isPending}
                            onClick={handleRetryAllFailed}
                        >
                            <RefreshCcw className="w-3.5 h-3.5" />
                            Retry All Failed ({failedCount})
                        </Button>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Auto-refresh 5s
                    </div>
                </div>
            </div>

            {/* Queue Health + Metrics Row */}
            <div className="grid gap-3 md:grid-cols-6">
                {/* Queue Health Card */}
                <Card className={`md:col-span-2 ${queueHealth?.connected ? '' : 'border-amber-200 bg-amber-50'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Queue Health</CardTitle>
                        {queueHealth?.connected ? (
                            <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                            <WifiOff className="h-4 w-4 text-amber-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-lg font-bold ${queueHealth?.connected ? 'text-green-600' : 'text-amber-600'}`}>
                            {queueHealth?.connected ? 'Connected' : 'DB-Only Mode'}
                        </div>
                        {queueHealth && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Waiting</span>
                                    <span className="font-mono font-medium">{queueHealth.waiting}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Active</span>
                                    <span className="font-mono font-medium">{queueHealth.active}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Completed</span>
                                    <span className="font-mono font-medium text-green-600">{queueHealth.completed}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Failed</span>
                                    <span className={`font-mono font-medium ${queueHealth.failed > 0 ? 'text-red-600' : ''}`}>{queueHealth.failed}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <MetricCard
                    title="Total Jobs" value={totalCount} subtitle="Last 50 visible"
                    icon={<Zap className="h-4 w-4 text-slate-400" />}
                />
                <MetricCard
                    title="Pending" value={pendingCount} subtitle="Awaiting processing"
                    icon={<RefreshCcw className="h-4 w-4 text-slate-400" />}
                />
                <MetricCard
                    title="Success Rate" value={`${successRate}%`} subtitle={`${succeededCount}/${finishedCount} finished`}
                    icon={<BarChart3 className={`h-4 w-4 ${successRate >= 90 ? 'text-green-500' : successRate >= 70 ? 'text-amber-500' : 'text-red-500'}`} />}
                    highlight={successRate < 90}
                />
                <MetricCard
                    title="Failed" value={failedCount} subtitle="Requires triage"
                    icon={<AlertTriangle className={`h-4 w-4 ${failedCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />}
                    highlight={failedCount > 0}
                />
            </div>

            {/* Error Pattern Groups */}
            {errorGroups.length > 0 && (
                <Card className="border-red-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Error Patterns ({errorGroups.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {errorGroups.slice(0, 5).map((group, i) => (
                            <div key={i} className="flex items-center justify-between bg-red-50 rounded-md px-3 py-2">
                                <div className="flex-1 min-w-0 mr-3">
                                    <p className="text-[10px] font-mono text-red-700 truncate">{group.pattern}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="destructive" className="text-[10px]">{group.count}x</Badge>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-[10px] h-6 px-2"
                                        disabled={retryMutation.isPending}
                                        onClick={() => group.jobIds.forEach(id => retryMutation.mutate(id))}
                                    >
                                        Retry all
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Filters + Table */}
            <div className="bg-white border rounded-md shadow-sm">
                <div className="p-3 border-b flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            placeholder="Search ID, correlationId, payloadHash..."
                            className="pl-8 bg-slate-50 text-xs h-9"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1">
                        {(['ALL', 'PENDING', 'SUCCEEDED', 'FAILED'] as StatusFilter[]).map(status => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                size="sm"
                                className="text-[10px] h-8 px-2.5"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                                {status === 'FAILED' && failedCount > 0 && (
                                    <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">{failedCount}</Badge>
                                )}
                            </Button>
                        ))}
                    </div>
                </div>

                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="text-[10px] font-semibold uppercase w-[100px]">Job ID</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Status</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Session</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Attempts</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Idempotency</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Correlation</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Created</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase">Error</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-slate-500 text-sm">
                                    Loading sync telemetry...
                                </TableCell>
                            </TableRow>
                        ) : filteredJobs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-slate-500 text-sm">
                                    No sync jobs match criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredJobs.map((job) => (
                                <TableRow key={job.id} className="text-xs">
                                    <TableCell className="font-mono text-[10px] text-slate-500">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger className="cursor-help">
                                                    {job.id.slice(0, 8)}...
                                                </TooltipTrigger>
                                                <TooltipContent><p className="font-mono text-xs">{job.id}</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                job.status === 'SUCCEEDED' ? 'default' :
                                                job.status === 'FAILED' ? 'destructive' : 'secondary'
                                            }
                                            className={`text-[10px] ${job.status === 'SUCCEEDED' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                        >
                                            {job.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-[10px] text-slate-600">
                                        {job.sessionId?.slice(0, 8) ?? '-'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className={job.attempts > 1 ? 'text-amber-600 font-medium' : ''}>
                                            {job.attempts}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {job.payloadHash && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger className="cursor-help font-mono text-[9px] text-slate-400">
                                                        {job.payloadHash.slice(0, 12)}...
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-mono text-xs">{job.payloadHash}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {job.correlationId && (
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {job.correlationId.slice(0, 8)}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-[10px] whitespace-nowrap">
                                        {formatInStudioTz(job.createdAt, 'MMM d, HH:mm', activeStudio?.timezone)}
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        {job.lastError && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger className="cursor-help text-[10px] font-mono text-red-600 truncate block max-w-[200px]">
                                                        {job.lastError}
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-sm">
                                                        <p className="font-mono text-xs whitespace-pre-wrap">{job.lastError}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {job.status === 'FAILED' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-[10px] h-7"
                                                disabled={retryMutation.isPending}
                                                onClick={() => retryMutation.mutate(job.id)}
                                            >
                                                Retry
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon, highlight }: {
    title: string;
    value: number | string;
    subtitle: string;
    icon: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <Card className={highlight ? "border-red-200 bg-red-50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${highlight ? 'text-red-600' : ''}`}>{value}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            </CardContent>
        </Card>
    );
}
