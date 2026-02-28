"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMyCoverOffers, useRespondCover, useCreateUnavailability, useNotifications } from '@/lib/api';
import { Calendar, UserCheck, CheckCircle, XCircle, Bell } from 'lucide-react';
import { useStudio } from '@/lib/studio-context';
import { formatInStudioTz } from '@/lib/timezone';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDistanceToNow } from 'date-fns';

export default function InstructorDashboardPage() {
    const { user, activeStudio } = useStudio();
    const instructorId = user?.instructorId ?? undefined;
    const { data: offers, isLoading: offersLoading } = useMyCoverOffers(instructorId);
    const { data: notifications } = useNotifications();
    const respondMutation = useRespondCover();
    const unavailMutation = useCreateUnavailability();

    const [unavailStart, setUnavailStart] = useState('');
    const [unavailEnd, setUnavailEnd] = useState('');
    const [unavailType, setUnavailType] = useState('SICK');
    const [unavailNote, setUnavailNote] = useState('');

    // Confirmation state
    const [acceptTarget, setAcceptTarget] = useState<{ opportunityId: string; className: string } | null>(null);
    const [declineTarget, setDeclineTarget] = useState<{ opportunityId: string; className: string } | null>(null);
    const [declineReason, setDeclineReason] = useState('');

    const handleMarkUnavailable = () => {
        if (!unavailStart || !unavailEnd) return;
        unavailMutation.mutate({
            instructorId: instructorId ?? '',
            startDateTimeUTC: new Date(unavailStart).toISOString(),
            endDateTimeUTC: new Date(unavailEnd).toISOString(),
            type: unavailType,
            note: unavailNote || undefined,
        }, {
            onSuccess: () => {
                setUnavailStart('');
                setUnavailEnd('');
                setUnavailNote('');
            },
        });
    };

    const pendingOffers = offers?.filter(o => o.response === 'PENDING') || [];
    const recentNotifications = (notifications ?? []).slice(0, 4);

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Instructor Dashboard</h2>

            <div className="grid gap-6 xl:grid-cols-3">
                {/* Mark Unavailable */}
                <Card className="xl:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Calendar className="w-5 h-5" />
                            Mark Unavailable
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Start</label>
                                <Input
                                    type="datetime-local"
                                    value={unavailStart}
                                    onChange={(e) => setUnavailStart(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">End</label>
                                <Input
                                    type="datetime-local"
                                    value={unavailEnd}
                                    onChange={(e) => setUnavailEnd(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {['SICK', 'HOLIDAY', 'PERSONAL'].map(t => (
                                <Button
                                    key={t}
                                    size="sm"
                                    variant={unavailType === t ? 'default' : 'outline'}
                                    onClick={() => setUnavailType(t)}
                                    className="text-xs"
                                >
                                    {t}
                                </Button>
                            ))}
                        </div>
                        <Input
                            placeholder="Optional note..."
                            value={unavailNote}
                            onChange={(e) => setUnavailNote(e.target.value)}
                        />
                        <Button
                            onClick={handleMarkUnavailable}
                            disabled={!unavailStart || !unavailEnd || unavailMutation.isPending}
                            className="w-full"
                        >
                            {unavailMutation.isPending ? 'Submitting...' : 'Submit Unavailability'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="xl:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Bell className="w-5 h-5" />
                            Recent Notifications
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {recentNotifications.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                No notifications yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentNotifications.map((notification) => (
                                    <div key={notification.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                                            {!notification.read && (
                                                <Badge className="text-[9px]">Unread</Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-600">{notification.body}</p>
                                        <p className="mt-2 text-[11px] text-slate-400">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Open Cover Opportunities */}
                <Card className="xl:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <UserCheck className="w-5 h-5" />
                            Cover Opportunities
                            {pendingOffers.length > 0 && (
                                <Badge variant="destructive" className="ml-2">{pendingOffers.length}</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {offersLoading ? (
                            <p className="text-sm text-slate-500">Loading...</p>
                        ) : pendingOffers.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                No open cover opportunities at this time.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingOffers.map((offer) => {
                                    const className = offer.opportunity.session.baseClassType?.name || 'Unknown Class';
                                    return (
                                        <div key={offer.id} className="border rounded-md p-3 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-sm">{className}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatInStudioTz(offer.opportunity.session.startDateTimeUTC, 'EEE, MMM d h:mm a', activeStudio?.timezone)}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        Originally: {offer.opportunity.session.baseInstructor?.fullName || 'Unassigned'}
                                                    </div>
                                                </div>
                                                {offer.rankScore != null && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Score: {Math.round(offer.rankScore)}
                                                    </Badge>
                                                )}
                                            </div>
                                            {offer.reason && (
                                                <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">{offer.reason}</p>
                                            )}
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1 gap-1"
                                                    disabled={respondMutation.isPending}
                                                    onClick={() => setAcceptTarget({
                                                        opportunityId: offer.opportunityId,
                                                        className,
                                                    })}
                                                >
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Accept
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 gap-1"
                                                    disabled={respondMutation.isPending}
                                                    onClick={() => {
                                                        setDeclineReason('');
                                                        setDeclineTarget({
                                                            opportunityId: offer.opportunityId,
                                                            className,
                                                        });
                                                    }}
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Decline
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Accept Confirmation */}
            <ConfirmDialog
                open={!!acceptTarget}
                onOpenChange={(open) => { if (!open) setAcceptTarget(null); }}
                title="Accept Cover"
                description={`You are accepting the cover for "${acceptTarget?.className}". This will assign you as the instructor for this session. Other pending offers will be automatically declined.`}
                confirmLabel="Accept Cover"
                onConfirm={async () => {
                    if (acceptTarget) {
                        await respondMutation.mutateAsync({
                            opportunityId: acceptTarget.opportunityId,
                            instructorId: instructorId ?? '',
                            response: 'ACCEPT',
                        });
                    }
                    setAcceptTarget(null);
                }}
                isPending={respondMutation.isPending}
            />

            {/* Decline Confirmation */}
            <ConfirmDialog
                open={!!declineTarget}
                onOpenChange={(open) => { if (!open) setDeclineTarget(null); }}
                title="Decline Cover"
                description={`Are you sure you want to decline the cover for "${declineTarget?.className}"?`}
                confirmLabel="Decline"
                onConfirm={async () => {
                    if (declineTarget) {
                        await respondMutation.mutateAsync({
                            opportunityId: declineTarget.opportunityId,
                            instructorId: instructorId ?? '',
                            response: 'DECLINE',
                            reason: declineReason || 'Not available',
                        });
                    }
                    setDeclineTarget(null);
                    setDeclineReason('');
                }}
                isPending={respondMutation.isPending}
            />
        </div>
    );
}
