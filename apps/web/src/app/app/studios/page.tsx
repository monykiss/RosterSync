"use client";

import { useState } from 'react';
import { useStudios, useCreateStudio, useUpdateStudio, useDeleteStudio, StudioRecord } from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Plus, Pencil, Trash2, Globe, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundaryCard } from '@/components/ErrorBoundaryCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const COMMON_TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Puerto_Rico', 'America/Phoenix', 'Pacific/Honolulu',
    'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

interface StudioFormData {
    name: string;
    timezone: string;
    wixSiteId: string;
    wixAccountId: string;
}

const emptyForm: StudioFormData = { name: '', timezone: 'America/New_York', wixSiteId: '', wixAccountId: '' };

export default function StudiosPage() {
    const { data: studios, isLoading, error, refetch } = useStudios();
    const { switchStudio, activeStudio } = useStudio();
    const createStudio = useCreateStudio();
    const updateStudio = useUpdateStudio();
    const deleteStudio = useDeleteStudio();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<StudioFormData>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const openCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (studio: StudioRecord) => {
        setEditId(studio.id);
        setForm({
            name: studio.name,
            timezone: studio.timezone,
            wixSiteId: studio.wixSiteId ?? '',
            wixAccountId: studio.wixAccountId ?? '',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dto = {
            name: form.name,
            timezone: form.timezone,
            wixSiteId: form.wixSiteId || undefined,
            wixAccountId: form.wixAccountId || undefined,
        };
        if (editId) {
            await updateStudio.mutateAsync({ id: editId, ...dto });
        } else {
            await createStudio.mutateAsync(dto);
        }
        setDialogOpen(false);
        setForm(emptyForm);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteStudio.mutateAsync(deleteTarget);
        setDeleteTarget(null);
    };

    if (error) return <ErrorBoundaryCard onRetry={refetch} />;

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Studios</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Manage your studio locations and timezone settings</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Studio
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editId ? 'Edit Studio' : 'Create Studio'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Name</label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Downtown Studio"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Timezone</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.timezone}
                                    onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                                >
                                    {COMMON_TIMEZONES.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Wix Site ID (optional)</label>
                                <Input
                                    value={form.wixSiteId}
                                    onChange={e => setForm(f => ({ ...f, wixSiteId: e.target.value }))}
                                    placeholder="abc-123-..."
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Wix Account ID (optional)</label>
                                <Input
                                    value={form.wixAccountId}
                                    onChange={e => setForm(f => ({ ...f, wixAccountId: e.target.value }))}
                                    placeholder="abc-123-..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createStudio.isPending || updateStudio.isPending}>
                                    {(createStudio.isPending || updateStudio.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                    {editId ? 'Save' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
            ) : !studios?.length ? (
                <EmptyState
                    icon={<Building2 className="w-6 h-6" />}
                    title="No studios yet"
                    description="Create your first studio to start managing schedules."
                    action={{ label: "Add Studio", onClick: openCreate }}
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">All Studios</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Timezone</TableHead>
                                    <TableHead className="text-center">Class Types</TableHead>
                                    <TableHead className="text-center">Instructors</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {studios.map(studio => (
                                    <TableRow key={studio.id} className={activeStudio?.id === studio.id ? 'bg-blue-50/50' : ''}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {studio.name}
                                                {activeStudio?.id === studio.id && (
                                                    <Badge variant="secondary" className="text-[9px]">Active</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Globe className="w-3.5 h-3.5" />
                                                <span className="text-xs">{studio.timezone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-sm">{studio._count?.classTypes ?? 0}</TableCell>
                                        <TableCell className="text-center text-sm">{studio._count?.instructors ?? 0}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {activeStudio?.id !== studio.id && (
                                                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => switchStudio(studio.id)}>
                                                        Switch
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(studio)}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(studio.id)}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                title="Delete Studio"
                description="This will permanently remove the studio and all associated data. This action cannot be undone."
                onConfirm={handleDelete}
                isPending={deleteStudio.isPending}
            />
        </div>
    );
}
