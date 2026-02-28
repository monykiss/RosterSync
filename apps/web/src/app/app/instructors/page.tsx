"use client";

import { useState } from 'react';
import { useInstructors, useCreateInstructor, useUpdateInstructor, useDeleteInstructor, useClassTypes, useUpdateInstructorSkills, InstructorRecord } from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Pencil, Trash2, Loader2, Mail, BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundaryCard } from '@/components/ErrorBoundaryCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface InstructorFormData {
    fullName: string;
    email: string;
    phone: string;
    maxWeeklySlots: string;
}

const emptyForm: InstructorFormData = { fullName: '', email: '', phone: '', maxWeeklySlots: '10' };

export default function InstructorsPage() {
    const { activeStudio } = useStudio();
    const studioId = activeStudio?.id;
    const { data: instructors, isLoading, error, refetch } = useInstructors(studioId);
    const { data: classTypes } = useClassTypes(studioId);
    const createInstructor = useCreateInstructor();
    const updateInstructor = useUpdateInstructor();
    const deleteInstructor = useDeleteInstructor();
    const updateSkills = useUpdateInstructorSkills();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<InstructorFormData>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Skills dialog
    const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
    const [skillsInstructor, setSkillsInstructor] = useState<InstructorRecord | null>(null);
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

    const openSkills = (inst: InstructorRecord) => {
        setSkillsInstructor(inst);
        setSelectedSkills(new Set(inst.skills.map(s => s.classType.id)));
        setSkillsDialogOpen(true);
    };

    const handleSaveSkills = async () => {
        if (!skillsInstructor) return;
        const skills = (classTypes ?? []).map(ct => ({
            classTypeId: ct.id,
            canTeach: selectedSkills.has(ct.id),
        }));
        await updateSkills.mutateAsync({ instructorId: skillsInstructor.id, skills });
        setSkillsDialogOpen(false);
    };

    const toggleSkill = (classTypeId: string) => {
        setSelectedSkills(prev => {
            const next = new Set(prev);
            if (next.has(classTypeId)) next.delete(classTypeId);
            else next.add(classTypeId);
            return next;
        });
    };

    const openCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (inst: InstructorRecord) => {
        setEditId(inst.id);
        setForm({
            fullName: inst.fullName,
            email: inst.email,
            phone: inst.phone ?? '',
            maxWeeklySlots: String(inst.maxWeeklySlots),
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studioId) return;
        const dto = {
            studioId,
            fullName: form.fullName,
            email: form.email,
            phone: form.phone || undefined,
            maxWeeklySlots: parseInt(form.maxWeeklySlots, 10) || 10,
        };
        if (editId) {
            await updateInstructor.mutateAsync({ id: editId, ...dto });
        } else {
            await createInstructor.mutateAsync(dto);
        }
        setDialogOpen(false);
        setForm(emptyForm);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteInstructor.mutateAsync(deleteTarget);
        setDeleteTarget(null);
    };

    if (!studioId) {
        return (
            <div className="p-8">
                <EmptyState
                    icon={<Users className="w-6 h-6" />}
                    title="No studio selected"
                    description="Select a studio from the sidebar to manage instructors."
                />
            </div>
        );
    }

    if (error) return <div className="p-8"><ErrorBoundaryCard onRetry={refetch} /></div>;

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Instructors</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{activeStudio?.name} — manage your instructor roster</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Instructor
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editId ? 'Edit Instructor' : 'Add Instructor'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <Input
                                    value={form.fullName}
                                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                                    placeholder="Jane Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Email</label>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="jane@studio.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Phone (optional)</label>
                                <Input
                                    value={form.phone}
                                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="+1 555-0100"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Max Weekly Slots</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={form.maxWeeklySlots}
                                    onChange={e => setForm(f => ({ ...f, maxWeeklySlots: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createInstructor.isPending || updateInstructor.isPending}>
                                    {(createInstructor.isPending || updateInstructor.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                    {editId ? 'Save' : 'Add'}
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
            ) : !instructors?.length ? (
                <EmptyState
                    icon={<Users className="w-6 h-6" />}
                    title="No instructors yet"
                    description="Add your instructor roster with their contact info and weekly availability."
                    action={{ label: "Add Instructor", onClick: openCreate }}
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{instructors.length} Instructor{instructors.length !== 1 && 's'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Skills</TableHead>
                                    <TableHead className="text-center">Max/Week</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instructors.map(inst => (
                                    <TableRow key={inst.id}>
                                        <TableCell className="font-medium">{inst.fullName}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Mail className="w-3 h-3" />
                                                <span className="text-xs">{inst.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {inst.skills.length === 0 ? (
                                                    <span className="text-xs text-slate-400">No skills</span>
                                                ) : (
                                                    inst.skills.map(s => (
                                                        <Badge key={s.id} variant="secondary" className="text-[10px]">
                                                            {s.classType.name}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-sm">{inst.maxWeeklySlots}</TableCell>
                                        <TableCell>
                                            <Badge variant={inst.isActive ? 'default' : 'secondary'} className="text-[10px]">
                                                {inst.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1" onClick={() => openSkills(inst)} title="Manage Skills">
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    Skills
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(inst)}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(inst.id)}>
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

            {/* Skills Dialog */}
            <Dialog open={skillsDialogOpen} onOpenChange={setSkillsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Skills — {skillsInstructor?.fullName}</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-slate-500 -mt-2">
                        Select which class types this instructor can teach.
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(classTypes ?? []).length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">
                                No class types found. <a href="/app/class-types" className="text-blue-600 underline">Add some first.</a>
                            </p>
                        ) : (
                            (classTypes ?? []).map(ct => (
                                <label
                                    key={ct.id}
                                    className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300"
                                        checked={selectedSkills.has(ct.id)}
                                        onChange={() => toggleSkill(ct.id)}
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-slate-700">{ct.name}</span>
                                        {ct.description && (
                                            <p className="text-xs text-slate-400">{ct.description}</p>
                                        )}
                                    </div>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-xs text-slate-400">
                            {selectedSkills.size} of {(classTypes ?? []).length} selected
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSkillsDialogOpen(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveSkills} disabled={updateSkills.isPending}>
                                {updateSkills.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                Save Skills
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                title="Delete Instructor"
                description="This will remove the instructor and unassign them from any scheduled sessions. This action cannot be undone."
                onConfirm={handleDelete}
                isPending={deleteInstructor.isPending}
            />
        </div>
    );
}
