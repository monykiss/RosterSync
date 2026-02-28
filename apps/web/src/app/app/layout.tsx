"use client";

import { CalendarRange, Inbox, Activity, Users, ClipboardList, Puzzle, UserCheck, LogOut, Building2, Clock, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StudioSwitcher } from '@/components/StudioSwitcher';
import { useAuth } from '@/lib/auth-context';
import { useStudio } from '@/lib/studio-context';
import { useUnreadNotificationCount } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    roles?: string[]; // if undefined, visible to all
    section?: string;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/app', label: 'Dashboard', icon: <CalendarRange className="h-4 w-4" />, roles: ['ADMIN', 'SCHEDULER'] },
    { href: '/app/covers', label: 'Covers', icon: <Inbox className="h-4 w-4" />, roles: ['ADMIN', 'SCHEDULER'] },
    { href: '/app/sync', label: 'Sync Status', icon: <Activity className="h-4 w-4" />, roles: ['ADMIN', 'SCHEDULER'] },
    { href: '/app/notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, roles: ['ADMIN', 'SCHEDULER', 'INSTRUCTOR'] },
    { href: '/app/instructor', label: 'My Schedule', icon: <UserCheck className="h-4 w-4" />, roles: ['INSTRUCTOR'] },
    // Config section
    { href: '/app/studios', label: 'Studios', icon: <Building2 className="h-4 w-4" />, section: 'Configuration', roles: ['ADMIN'] },
    { href: '/app/instructors', label: 'Instructors', icon: <Users className="h-4 w-4" />, section: 'Configuration', roles: ['ADMIN'] },
    { href: '/app/class-types', label: 'Class Types', icon: <ClipboardList className="h-4 w-4" />, section: 'Configuration', roles: ['ADMIN'] },
    { href: '/app/slots', label: 'Slot Templates', icon: <Clock className="h-4 w-4" />, section: 'Configuration', roles: ['ADMIN', 'SCHEDULER'] },
    { href: '/app/compatibility', label: 'Compatibility', icon: <Puzzle className="h-4 w-4" />, section: 'Configuration', roles: ['ADMIN'] },
];

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    SCHEDULER: 'bg-blue-100 text-blue-700',
    INSTRUCTOR: 'bg-green-100 text-green-700',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { user: authUser, logout } = useAuth();
    const { user: studioUser } = useStudio();
    const { unreadCount } = useUnreadNotificationCount();
    const pathname = usePathname();
    const user = authUser ?? (studioUser ? {
        id: studioUser.id,
        email: studioUser.email,
        role: studioUser.role as 'ADMIN' | 'SCHEDULER' | 'INSTRUCTOR',
    } : null);

    // Filter nav items by role
    const visibleItems = NAV_ITEMS.filter(item => {
        if (!item.roles) return true;
        return !!user && item.roles.includes(user.role);
    });

    // Group by section
    let lastSection: string | undefined;

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-white flex flex-col">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">RosterSyncOS</h1>
                    <p className="text-xs text-slate-500">Schedule-of-Record Control Plane</p>
                </div>

                {/* Studio Switcher */}
                <div className="border-b">
                    <StudioSwitcher />
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {visibleItems.map(item => {
                        const showSectionHeader = item.section && item.section !== lastSection;
                        lastSection = item.section;
                        const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));

                        return (
                            <div key={item.href}>
                                {showSectionHeader && (
                                    <div className="pt-6 pb-2">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">{item.section}</p>
                                    </div>
                                )}
                                <Link
                                    href={item.href}
                                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'bg-slate-100 text-slate-900'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.href === '/app/notifications' && unreadCount > 0 && (
                                        <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0">
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                {/* User Footer */}
                <div className="p-4 border-t space-y-2">
                    {user && (
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{user.email}</p>
                                <Badge className={`text-[9px] mt-0.5 ${ROLE_COLORS[user.role] ?? ''}`}>
                                    {user.role}
                                </Badge>
                            </div>
                            <button
                                onClick={logout}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-400">StudioCore Enterprise</p>
                </div>
            </aside>

            {/* Main viewport */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
