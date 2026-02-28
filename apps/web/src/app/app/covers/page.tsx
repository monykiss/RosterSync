"use client";

import { Inbox, CheckCircle, Clock, Users, ArrowRight, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudioCovers, useRespondCover, useCancelCover, CoverOpportunity } from '@/lib/api';
import { useState } from 'react';
import { useStudio } from '@/lib/studio-context';
import { formatInStudioTz } from '@/lib/timezone';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type StatusFilter = 'ALL' | 'OPEN' | 'OFFERED' | 'ASSIGNED' | 'CANCELLED';

export default function CoversPage() {
    const { activeStudio } = useStudio();
    const { data: covers, isLoading } = useStudioCovers(activeStudio?.id);
    const respondMutation = useRespondCover();
    const cancelMutation = useCancelCover();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);

    const allCovers: CoverOpportunity[] = covers || [];

    const openCount = allCovers.filter(c => ['OPEN', 'OFFERED'].includes(c.status)).length;
    const assignedCount = allCovers.filter(c => c.status === 'ASSIGNED').length;
    const totalOffers = allCovers.reduce((acc, c) => acc + c.offers.length, 0);
    const pendingOffers = allCovers.reduce((acc, c) => acc + c.offers.filter(o => o.response === 'PENDING').length, 0);

    const filteredCovers = allCovers.filter(c => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const className = c.session?.baseClassType?.name?.toLowerCase() ?? '';
            const instructorName = c.session?.baseInstructor?.fullName?.toLowerCase() ?? '';
            return className.includes(q) || instructorName.includes(q);
        }
        return true;
    });

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Inbox className="w-6 h-6 text-blue-600" />
                    Cover Marketplace
                </h2>
            </div>

            {/* Metrics */}
            <div className="grid gap-3 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Open</CardTitle>
                        <Inbox className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{openCount}</div>
                        <p className="text-[10px] text-muted-foreground">Awaiting response</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Assigned</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{assignedCount}</div>
                        <p className="text-[10px] text-muted-foreground">Cover accepted</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Total Offers</CardTitle>
                        <Users className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOffers}</div>
                        <p className="text-[10px] text-muted-foreground">Distributed to instructors</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium">Pending Responses</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{pendingOffers}</div>
                        <p className="text-[10px] text-muted-foreground">Awaiting instructor action</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <Input
                    placeholder="Search by class or instructor..."
                    className="max-w-xs text-xs h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex gap-1">
                    {(['ALL', 'OPEN', 'OFFERED', 'ASSIGNED', 'CANCELLED'] as StatusFilter[]).map(status => (
                        <Button
                            key={status}
                            variant={statusFilter === status ? "default" : "outline"}
                            size="sm"
                            className="text-[10px] h-8 px-2.5"
                            onClick={() => setStatusFilter(status)}
                        >
                            {status}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Cover Cards */}
            {isLoading ? (
                <div className="border rounded-md p-8 text-center bg-slate-50 text-slate-500 text-sm">
                    Loading cover opportunities...
                </div>
            ) : filteredCovers.length === 0 ? (
                <div className="border rounded-md p-8 text-center bg-slate-50 text-slate-500 text-sm">
                    No cover opportunities match your filters.
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filteredCovers.map((opp) => (
                        <CoverCard
                            key={opp.id}
                            opportunity={opp}
                            timezone={activeStudio?.timezone}
                            onAccept={(instructorId) => respondMutation.mutate({
                                opportunityId: opp.id,
                                instructorId,
                                response: 'ACCEPT',
                            })}
                            onCancel={() => setCancelTarget(opp.id)}
                            isPending={respondMutation.isPending}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!cancelTarget}
                onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
                title="Cancel Cover Request"
                description="This will cancel the cover request and reset the session status back to Scheduled. Any pending offers will be discarded."
                confirmLabel="Cancel Request"
                onConfirm={async () => {
                    if (cancelTarget) await cancelMutation.mutateAsync(cancelTarget);
                    setCancelTarget(null);
                }}
                isPending={cancelMutation.isPending}
            />
        </div>
    );
}

function CoverCard({ opportunity, onAccept, onCancel, isPending, timezone }: {
    opportunity: CoverOpportunity;
    onAccept: (instructorId: string) => void;
    onCancel: () => void;
    isPending: boolean;
    timezone?: string | null;
}) {
    const session = opportunity.session;
    const className = session?.baseClassType?.name || 'Unknown Class';
    const originalInstructor = session?.baseInstructor?.fullName || 'Unassigned';
    const dateStr = session?.startDateTimeUTC
        ? formatInStudioTz(session.startDateTimeUTC, 'EEE, MMM d', timezone)
        : '-';
    const timeStr = session?.startDateTimeUTC
        ? formatInStudioTz(session.startDateTimeUTC, 'h:mm a', timezone)
        : '-';

    const acceptedOffer = opportunity.offers.find(o => o.response === 'ACCEPT');

    const statusColor = opportunity.status === 'ASSIGNED'
        ? 'bg-green-50 border-green-200'
        : ['OPEN', 'OFFERED'].includes(opportunity.status)
            ? 'bg-white border-amber-200'
            : 'bg-slate-50 border-slate-200';

    return (
        <Card className={`${statusColor} overflow-hidden`}>
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900">{className}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{dateStr} at {timeStr}</p>
                    </div>
                    <Badge
                        variant={opportunity.status === 'ASSIGNED' ? 'default' : opportunity.status === 'CANCELLED' ? 'secondary' : 'outline'}
                        className="text-[10px]"
                    >
                        {opportunity.status}
                    </Badge>
                </div>

                {/* Original instructor */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Originally:</span>
                    <span className="font-medium text-slate-700">{originalInstructor}</span>
                </div>

                {/* Accepted */}
                {acceptedOffer && (
                    <div className="bg-green-50 border border-green-100 rounded-md p-2.5 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="text-xs">
                            <span className="font-medium text-green-800">{acceptedOffer.instructor.fullName}</span>
                            <span className="text-green-600 ml-1">accepted</span>
                            {acceptedOffer.rankScore !== null && (
                                <span className="text-green-500 ml-1">(score: {Math.round(acceptedOffer.rankScore)})</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Offer List */}
                {opportunity.offers.length > 0 && !acceptedOffer && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                            Ranked Candidates ({opportunity.offers.length})
                        </p>
                        {opportunity.offers.map((offer) => (
                            <div key={offer.id} className="flex items-center justify-between text-xs border rounded-md p-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{offer.instructor.fullName}</span>
                                    {offer.rankScore !== null && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                                            {Math.round(offer.rankScore)}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge
                                        variant={offer.response === 'ACCEPT' ? 'default' : offer.response === 'DECLINE' ? 'destructive' : 'secondary'}
                                        className="text-[9px] px-1.5 py-0"
                                    >
                                        {offer.response}
                                    </Badge>
                                    {offer.response === 'PENDING' && (
                                        <Button
                                            size="sm"
                                            className="text-[10px] h-6 px-2"
                                            disabled={isPending}
                                            onClick={() => onAccept(offer.instructorId)}
                                        >
                                            Accept
                                            <ArrowRight className="w-3 h-3 ml-0.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {opportunity.offers.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-2 border rounded-md bg-slate-50">
                        No candidates offered yet
                    </div>
                )}

                {/* Cancel action for open/offered covers */}
                {['OPEN', 'OFFERED'].includes(opportunity.status) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                        onClick={onCancel}
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Cover Request
                    </Button>
                )}

                {/* Reason/compatibility hint */}
                {opportunity.offers.some(o => o.reason) && (
                    <div className="text-[10px] text-slate-400 bg-slate-50 rounded p-2 font-mono">
                        {opportunity.offers.find(o => o.reason)?.reason}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
