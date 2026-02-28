"use client";

import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications, useMarkNotificationRead, NotificationRecord } from '@/lib/api';

function NotificationSection({
    title,
    notifications,
    onMarkRead,
    isPending,
}: {
    title: string;
    notifications: NotificationRecord[];
    onMarkRead: (notificationId: string) => void;
    isPending: boolean;
}) {
    if (notifications.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`rounded-md border p-3 ${notification.read ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                    <Badge variant={notification.read ? 'secondary' : 'default'} className="text-[10px]">
                                        {notification.type.replaceAll('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                                <p className="mt-2 text-xs text-slate-400">
                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                </p>
                            </div>
                            {!notification.read && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 text-xs"
                                    disabled={isPending}
                                    onClick={() => onMarkRead(notification.id)}
                                >
                                    Mark read
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

export default function NotificationsPage() {
    const { data: notifications, isLoading } = useNotifications();
    const markReadMutation = useMarkNotificationRead();

    const unread = (notifications ?? []).filter(notification => !notification.read);
    const read = (notifications ?? []).filter(notification => notification.read);

    return (
        <div className="p-8 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-600" />
                        Notifications
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        In-app delivery for cover activity, publishing, and sync health.
                    </p>
                </div>
                <Badge variant="outline" className="text-xs">
                    {unread.length} unread
                </Badge>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="py-10 text-sm text-slate-500">
                        Loading notifications...
                    </CardContent>
                </Card>
            ) : (notifications ?? []).length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No notifications yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <NotificationSection
                        title="Unread"
                        notifications={unread}
                        isPending={markReadMutation.isPending}
                        onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
                    />
                    <NotificationSection
                        title="Recent"
                        notifications={read}
                        isPending={markReadMutation.isPending}
                        onMarkRead={(notificationId) => markReadMutation.mutate(notificationId)}
                    />
                    {unread.length > 0 && (
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                className="text-xs gap-1.5"
                                disabled={markReadMutation.isPending}
                                onClick={() => unread.forEach(notification => markReadMutation.mutate(notification.id))}
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Mark all unread
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
