"use client";

import { useWeeksList, useDashboardStats } from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarRange, ArrowRight, Plus, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { GettingStarted } from '@/components/GettingStarted';
import { formatInStudioTz } from '@/lib/timezone';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { ApiConnectionBanner } from '@/components/ApiConnectionBanner';

interface WeekItem {
    id: string;
    weekStartDate: string;
    status: string;
    publishVersion: number;
    studio?: { name: string };
}

export default function DashboardPage() {
    const { activeStudio, isLoading: studioLoading } = useStudio();
    const { data: weeks, isLoading: weeksLoading } = useWeeksList();
    const { data: stats } = useDashboardStats();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!studioLoading && !weeksLoading && weeks?.length === 1) {
            router.push(`/app/weeks/${weeks[0].id}/planner`);
        }
    }, [studioLoading, weeksLoading, weeks, router]);

    const getNextMonday = (): string => {
        const now = new Date();
        const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
        const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
        const monday = new Date(now);
        monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
        return monday.toISOString().split('T')[0]; // "YYYY-MM-DD"
    };

    const handleGenerateWeek = async () => {
        if (!activeStudio) return;
        setGenerating(true);
        try {
            const weekStartDate = getNextMonday();
            const { data } = await api.post('/weeks/generate', {
                studioId: activeStudio.id,
                weekStartDate,
            });
            queryClient.invalidateQueries({ queryKey: ['weeksList'] });
            toast({ title: "Week Generated", description: `Created week starting ${data.weekStartDate ?? weekStartDate}` });
            router.push(`/app/weeks/${data.id}/planner`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Could not generate week';
            toast({ title: "Generation Failed", description: message, variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };

    if (studioLoading || weeksLoading) {
        return (
            <div className="flex items-center justify-center h-full py-32">
                <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Loading workspace...</p>
                </div>
            </div>
        );
    }

    const weeksList: WeekItem[] = weeks ?? [];
    const tz = activeStudio?.timezone;

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <ApiConnectionBanner />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {activeStudio ? activeStudio.name : 'Select a studio to get started'}
                    </p>
                </div>
                {activeStudio && (
                    <Button onClick={handleGenerateWeek} disabled={generating} size="sm" className="gap-1.5">
                        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Generate Week
                    </Button>
                )}
            </div>

            <Card className="border-amber-200 bg-amber-50/70">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Demo Mode</p>
                            <p className="text-sm text-amber-800 mt-1">
                                Demo auth is enabled, Wix sync is simulated in STUB mode, and the current data set is seeded for client walkthroughs.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {weeksList.length === 0 ? (
                <GettingStarted />
            ) : (
                <div className="space-y-6">
                    {/* Analytics Cards */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatsCard
                                icon={<CalendarRange className="w-4 h-4 text-blue-600" />}
                                label="Sessions This Week"
                                value={stats.totalSessions}
                            />
                            <StatsCard
                                icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
                                label="Fill Rate"
                                value={`${stats.fillRate}%`}
                                accent={stats.fillRate >= 90 ? 'green' : stats.fillRate >= 70 ? 'amber' : 'red'}
                            />
                            <StatsCard
                                icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                                label="Needs Cover"
                                value={stats.needsCover}
                                accent={stats.needsCover > 0 ? 'amber' : undefined}
                            />
                            <StatsCard
                                icon={<RefreshCw className="w-4 h-4 text-slate-600" />}
                                label="Sync Health"
                                value={`${stats.syncRate}%`}
                                accent={stats.syncRate < 90 ? 'red' : 'green'}
                                detail={stats.syncFailed > 0 ? `${stats.syncFailed} failed` : undefined}
                            />
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <CalendarRange className="w-5 h-5 text-blue-600" />
                            Weekly Schedules
                        </h2>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {weeksList.map((week: WeekItem) => (
                            <Card
                                key={week.id}
                                className="cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
                                onClick={() => router.push(`/app/weeks/${week.id}/planner`)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold">
                                            Week of {formatInStudioTz(week.weekStartDate, 'MMM d, yyyy', tz)}
                                        </CardTitle>
                                        <Badge
                                            variant={week.status === 'PUBLISHED' ? 'default' : 'secondary'}
                                            className="text-[10px]"
                                        >
                                            {week.status === 'PUBLISHED' ? `v${week.publishVersion}` : 'DRAFT'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">
                                            {week.studio?.name ?? 'Studio'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatsCard({
    icon,
    label,
    value,
    accent,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    accent?: 'green' | 'amber' | 'red';
    detail?: string;
}) {
    const accentColors = {
        green: 'text-green-700',
        amber: 'text-amber-700',
        red: 'text-red-700',
    };

    return (
        <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-medium text-slate-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${accent ? accentColors[accent] : 'text-slate-900'}`}>
                {value}
            </div>
            {detail && (
                <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>
            )}
        </Card>
    );
}
