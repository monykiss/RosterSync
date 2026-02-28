"use client";

import { useState } from 'react';
import { useCompatibilityRules, useCreateCompatibilityRule, useDeleteCompatibilityRule, useClassTypes } from '@/lib/api';
import { useStudio } from '@/lib/studio-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Puzzle, Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundaryCard } from '@/components/ErrorBoundaryCard';

interface RuleFormData {
    fromClassTypeId: string;
    toClassTypeId: string;
    priority: string;
    reasonTemplate: string;
}

const emptyForm: RuleFormData = { fromClassTypeId: '', toClassTypeId: '', priority: '1', reasonTemplate: '' };

export default function CompatibilityPage() {
    const { activeStudio } = useStudio();
    const studioId = activeStudio?.id;
    const { data: rules, isLoading, error, refetch } = useCompatibilityRules(studioId);
    const { data: classTypes } = useClassTypes(studioId);
    const createRule = useCreateCompatibilityRule();
    const deleteRule = useDeleteCompatibilityRule();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<RuleFormData>(emptyForm);

    const openCreate = () => {
        setForm({
            ...emptyForm,
            fromClassTypeId: classTypes?.[0]?.id ?? '',
            toClassTypeId: classTypes?.[1]?.id ?? classTypes?.[0]?.id ?? '',
        });
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studioId) return;
        await createRule.mutateAsync({
            studioId,
            fromClassTypeId: form.fromClassTypeId,
            toClassTypeId: form.toClassTypeId,
            priority: parseInt(form.priority, 10) || 1,
            reasonTemplate: form.reasonTemplate || undefined,
        });
        setDialogOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this compatibility rule?')) return;
        await deleteRule.mutateAsync(id);
    };

    if (!studioId) {
        return (
            <div className="p-8">
                <EmptyState
                    icon={<Puzzle className="w-6 h-6" />}
                    title="No studio selected"
                    description="Select a studio from the sidebar to manage compatibility rules."
                />
            </div>
        );
    }

    if (error) return <div className="p-8"><ErrorBoundaryCard onRetry={refetch} /></div>;

    return (
        <div className="p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Compatibility Rules</h1>
                    <p className="text-sm text-slate-500 mt-0.5">{activeStudio?.name} — define which class types can substitute for each other</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate} disabled={!classTypes?.length}>
                            <Plus className="w-3.5 h-3.5" /> Add Rule
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Compatibility Rule</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">From Class Type</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.fromClassTypeId}
                                    onChange={e => setForm(f => ({ ...f, fromClassTypeId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select...</option>
                                    {classTypes?.map(ct => (
                                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-center">
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Can Be Substituted By</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.toClassTypeId}
                                    onChange={e => setForm(f => ({ ...f, toClassTypeId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select...</option>
                                    {classTypes?.map(ct => (
                                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Priority (1 = highest)</label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={form.priority}
                                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Reason Template (optional)</label>
                                <Input
                                    value={form.reasonTemplate}
                                    onChange={e => setForm(f => ({ ...f, reasonTemplate: e.target.value }))}
                                    placeholder="e.g. Yoga can be covered by Pilates instructor"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={createRule.isPending}>
                                    {createRule.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                                    Create Rule
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
            ) : !rules?.length ? (
                <EmptyState
                    icon={<Puzzle className="w-6 h-6" />}
                    title="No compatibility rules yet"
                    description="Define which class types can substitute for each other during covers. You need at least two class types first."
                    action={classTypes?.length ? { label: "Add Rule", onClick: openCreate } : { label: "Add Class Types First", href: "/app/class-types" }}
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{rules.length} Rule{rules.length !== 1 && 's'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>From</TableHead>
                                    <TableHead></TableHead>
                                    <TableHead>Can Sub With</TableHead>
                                    <TableHead className="text-center">Priority</TableHead>
                                    <TableHead>Reason Template</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map(rule => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-medium">{rule.fromClassType.name}</TableCell>
                                        <TableCell className="text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-auto" /></TableCell>
                                        <TableCell className="font-medium">{rule.toClassType.name}</TableCell>
                                        <TableCell className="text-center text-sm">{rule.priority}</TableCell>
                                        <TableCell className="text-sm text-slate-500 max-w-xs truncate">{rule.reasonTemplate || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(rule.id)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
