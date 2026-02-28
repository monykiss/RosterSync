"use client";

import { useState } from 'react';
import {
    useSlotTemplates, useCreateSlotTemplate, useUpdateSlotTemplate, useDeleteSlotTemplate,
    useClassTypes, useInstructors, SlotTemplateRecord
} from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundaryCard } from '@/components/ErrorBoundaryCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SlotFormData {
    name: string;
    weekday: string;
    startTime: string;
    durationMins: string;
    defaultClassTypeId: string;
    defaultInstructorId: string;
    locationLabel: string;
}

const emptyForm: SlotFormData = {
    name: '', weekday: '1', startTime: '09:00', durationMins: '50',
    defaultClassTypeId: '', defaultInstructorId: '', locationLabel: '',
};

export default function SlotsPage() {
    const { activeStudio } = useStudio();
    const studioId = activeStudio?.id;
    const { data: slots, isLoading, error, refetch } = useSlotTemplates(studioId);
    const { data: classTypes } = useClassTypes(studioId);
    const { data: instructors } = useInstructors(studioId);
    const createSlot = useCreateSlotTemplate();
    const updateSlot = useUpdateSlotTemplate();
    const deleteSlot = useDeleteSlotTemplate();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<SlotFormData>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const openCreate = () => {
        setEditId(null);
        setForm({ ...emptyForm, defaultClassTypeId: classTypes?.[0]?.id ?? '' });
        setDialogOpen(true);
    };

    const openEdit = (slot: SlotTemplateRecord) => {
        setEditId(slot.id);
        setForm({
            name: slot.name,
            weekday: String(slot.weekday),
            startTime: slot.startTime,
            durationMins: String(slot.durationMins),
            defaultClassTypeId: slot.defaultClassTypeId,
            defaultInstructorId: slot.defaultInstructorId ?? '',
            locationLabel: slot.locationLabel ?? '',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studioId) return;
        const dto = {
            studioId,
            name: form.name,
            weekday: parseInt(form.weekday, 10),
            startTime: form.startTime,
            durationMins: parseInt(form.durationMins, 10),
            defaultClassTypeId: form.defaultClassTypeId,
            defaultInstructorId: form.defaultInstructorId || undefined,
            locationLabel: form.locationLabel || undefined,
        };
        if (editId) {
            await updateSlot.mutateAsync({ id: editId, ...dto });
        } else {
            await createSlot.mutateAsync(dto);
        }
        setDialogOpen(false);
        setForm(emptyForm);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteSlot.mutateAsync(deleteTarget);
        setDeleteTarget(null);
    };

    if (!studioId) {
        return (
            <div className="p-8">
                <EmptyState
                    icon={<Clock className="w-6 h-6" />}
                    title="No studio selected"
                    description="Select a studio from the sidebar to manage slot templates."
                />
            </div>
        );
    }

    if (error) return <div className="p-8"><ErrorBoundaryCard onRetry={refetch} /></div>;

    // Group by weekday for visual clarity
    const sortedSlots = [...(slots ?? [])].sort((a, b) => {
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return a.startTime.localeCompare(b.startTime);
    });

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Slot Templates</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {activeStudio?.name} — define recurring weekly time slots for week generation
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate} disabled={!classTypes?.length}>
                            <Plus className="w-3.5 h-3.5" /> Add Slot
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editId ? 'Edit Slot Template' : 'Create Slot Template'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Name</label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Monday Morning Yoga"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Day</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={form.weekday}
                                        onChange={e => setForm(f => ({ ...f, weekday: e.target.value }))}
                                    >
                                        {WEEKDAYS.map((day, i) => (
                                            <option key={i} value={i}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Start Time</label>
                                    <Input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Duration (minutes)</label>
                                <Input
                                    type="number"
                                    min="15"
                                    max="180"
                                    value={form.durationMins}
                                    onChange={e => setForm(f => ({ ...f, durationMins: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Class Type</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.defaultClassTypeId}
                                    onChange={e => setForm(f => ({ ...f, defaultClassTypeId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select...</option>
                                    {classTypes?.map(ct => (
                                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Default Instructor (optional)</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.defaultInstructorId}
                                    onChange={e => setForm(f => ({ ...f, defaultInstructorId: e.target.value }))}
                                >
                                    <option value="">None</option>
                                    {instructors?.map(inst => (
                                        <option key={inst.id} value={inst.id}>{inst.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Location (optional)</label>
                                <Input
                                    value={form.locationLabel}
                                    onChange={e => setForm(f => ({ ...f, locationLabel: e.target.value }))}
                                    placeholder="e.g. Studio A, Room 2"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createSlot.isPending || updateSlot.isPending}>
                                    {(createSlot.isPending || updateSlot.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
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
            ) : !sortedSlots.length ? (
                <EmptyState
                    icon={<Clock className="w-6 h-6" />}
                    title="No slot templates yet"
                    description="Create recurring time slots that define your weekly schedule. These are used when generating a new week."
                    action={classTypes?.length
                        ? { label: "Add Slot Template", onClick: openCreate }
                        : { label: "Add Class Types First", href: "/app/class-types" }
                    }
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{sortedSlots.length} Slot Template{sortedSlots.length !== 1 && 's'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Day</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Class Type</TableHead>
                                    <TableHead>Instructor</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSlots.map(slot => (
                                    <TableRow key={slot.id}>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] font-mono">
                                                {WEEKDAY_SHORT[slot.weekday]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {slot.startTime}
                                            <span className="text-slate-400 ml-1 text-xs">({slot.durationMins}m)</span>
                                        </TableCell>
                                        <TableCell className="font-medium">{slot.name}</TableCell>
                                        <TableCell className="text-sm">{slot.defaultClassType?.name ?? '—'}</TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {slot.defaultInstructor?.fullName ?? <span className="text-slate-400">Unassigned</span>}
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500">{slot.locationLabel || '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={slot.isActive ? 'default' : 'secondary'} className="text-[10px]">
                                                {slot.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(slot)}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(slot.id)}>
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
                title="Delete Slot Template"
                description="Future week generations will no longer include this slot. Existing sessions are not affected. This action cannot be undone."
                onConfirm={handleDelete}
                isPending={deleteSlot.isPending}
            />
        </div>
    );
}
