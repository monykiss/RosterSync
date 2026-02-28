"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ApiConnectionBanner } from '@/components/ApiConnectionBanner';

const DEMO_ACCOUNTS = [
    { label: 'Admin Demo', email: 'admin@rostersyncos.io', password: 'Admin2026!' },
    { label: 'Scheduler Demo', email: 'scheduler@rostersyncos.io', password: 'Demo2026!' },
    { label: 'Instructor Demo', email: 'carole@rostersyncos.io', password: 'Demo2026!' },
];

export default function LoginPage() {
    const { login, register, isAuthenticated } = useAuth();
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('ADMIN');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already authenticated
    if (isAuthenticated) {
        router.push('/');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(email, password, role);
            }
            router.push('/');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Authentication failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900">RosterSyncOS</h1>
                    <p className="text-sm text-slate-500">Schedule-of-Record Control Plane</p>
                </div>

                <ApiConnectionBanner />

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg">
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
                                <Input
                                    type="email"
                                    placeholder="admin@studio.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">Password</label>
                                <Input
                                    type="password"
                                    placeholder="Min 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>

                            {mode === 'register' && (
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Role</label>
                                    <div className="flex gap-2">
                                        {['ADMIN', 'SCHEDULER', 'INSTRUCTOR'].map(r => (
                                            <Button
                                                key={r}
                                                type="button"
                                                size="sm"
                                                variant={role === r ? 'default' : 'outline'}
                                                className="flex-1 text-xs"
                                                onClick={() => setRole(r)}
                                            >
                                                {r}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md p-2">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{mode === 'login' ? 'Signing in...' : 'Creating...'}</>
                                ) : (
                                    mode === 'login' ? 'Sign In' : 'Create Account'
                                )}
                            </Button>
                        </form>

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                            >
                                {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign In'}
                            </button>
                        </div>

                        {mode === 'login' && (
                            <div className="mt-4 border-t pt-4">
                                <p className="text-xs font-medium text-slate-600 mb-2">Seeded demo access</p>
                                <div className="grid gap-2">
                                    {DEMO_ACCOUNTS.map(account => (
                                        <Button
                                            key={account.label}
                                            type="button"
                                            variant="outline"
                                            className="justify-start text-xs"
                                            onClick={() => {
                                                setEmail(account.email);
                                                setPassword(account.password);
                                                setError('');
                                            }}
                                        >
                                            {account.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] text-slate-400">
                    StudioCore Enterprise Platform
                </p>
            </div>
        </div>
    );
}
