"use client";

import { useState } from 'react';
import { useClassTypes, useCreateClassType, useUpdateClassType, useDeleteClassType, ClassTypeRecord } from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardList, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundaryCard } from '@/components/ErrorBoundaryCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface ClassTypeFormData {
    name: string;
    description: string;
    tags: string;
}

const emptyForm: ClassTypeFormData = { name: '', description: '', tags: '' };

export default function ClassTypesPage() {
    const { activeStudio } = useStudio();
    const studioId = activeStudio?.id;
    const { data: classTypes, isLoading, error, refetch } = useClassTypes(studioId);
    const createClassType = useCreateClassType();
    const updateClassType = useUpdateClassType();
    const deleteClassType = useDeleteClassType();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<ClassTypeFormData>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const openCreate = () => {
        setEditId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (ct: ClassTypeRecord) => {
        setEditId(ct.id);
        setForm({
            name: ct.name,
            description: ct.description ?? '',
            tags: (ct.tags ?? []).join(', '),
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studioId) return;
        const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
        const dto = { studioId, name: form.name, description: form.description || undefined, tags };
        if (editId) {
            await updateClassType.mutateAsync({ id: editId, ...dto });
        } else {
            await createClassType.mutateAsync(dto);
        }
        setDialogOpen(false);
        setForm(emptyForm);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteClassType.mutateAsync(deleteTarget);
        setDeleteTarget(null);
    };

    if (!studioId) {
        return (
            <div className="p-8">
                <EmptyState
                    icon={<ClipboardList className="w-6 h-6" />}
                    title="No studio selected"
                    description="Select a studio from the sidebar to manage class types."
                />
            </div>
        );
    }

    if (error) return <div className="p-8"><ErrorBoundaryCard onRetry={refetch} /></div>;

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Class Types</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{activeStudio?.name} — define the classes your studio offers</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Class Type
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editId ? 'Edit Class Type' : 'Create Class Type'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Name</label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Yoga, HIIT, Pilates"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Description (optional)</label>
                                <Input
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="A brief description of this class type"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Tags (comma-separated)</label>
                                <Input
                                    value={form.tags}
                                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                                    placeholder="e.g. cardio, strength, flexibility"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createClassType.isPending || updateClassType.isPending}>
                                    {(createClassType.isPending || updateClassType.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
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
            ) : !classTypes?.length ? (
                <EmptyState
                    icon={<ClipboardList className="w-6 h-6" />}
                    title="No class types yet"
                    description="Define the types of classes your studio offers (e.g. Yoga, HIIT, Pilates)."
                    action={{ label: "Add Class Type", onClick: openCreate }}
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{classTypes.length} Class Type{classTypes.length !== 1 && 's'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Tags</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classTypes.map(ct => (
                                    <TableRow key={ct.id}>
                                        <TableCell className="font-medium">{ct.name}</TableCell>
                                        <TableCell className="text-sm text-slate-500 max-w-xs truncate">{ct.description || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {(ct.tags ?? []).map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={ct.isActive ? 'default' : 'secondary'} className="text-[10px]">
                                                {ct.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ct)}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(ct.id)}>
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
                title="Delete Class Type"
                description="This will remove the class type. Any slot templates using it will need to be updated. This action cannot be undone."
                onConfirm={handleDelete}
                isPending={deleteClassType.isPending}
            />
        </div>
    );
}
