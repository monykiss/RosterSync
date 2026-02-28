"use client";

import { CheckCircle2, Circle, ArrowRight, Building2, Users, ClipboardList, CalendarRange, Puzzle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudio } from '@/lib/studio-context';
import { useClassTypes, useInstructors, useCompatibilityRules, useSlotTemplates } from '@/lib/api';

interface SetupStep {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    done: boolean;
}

export function GettingStarted() {
    const { activeStudio, studios } = useStudio();
    const studioId = activeStudio?.id;
    const { data: classTypes } = useClassTypes(studioId);
    const { data: instructors } = useInstructors(studioId);
    const { data: rules } = useCompatibilityRules(studioId);
    const { data: slotTemplates } = useSlotTemplates(studioId);

    const steps: SetupStep[] = [
        {
            id: 'studio',
            label: 'Create a Studio',
            description: 'Set up your first studio with timezone and Wix integration details.',
            icon: <Building2 className="w-4 h-4" />,
            href: '/app/studios',
            done: studios.length > 0,
        },
        {
            id: 'class-types',
            label: 'Add Class Types',
            description: 'Define the types of classes your studio offers (e.g., Yoga, HIIT, Pilates).',
            icon: <ClipboardList className="w-4 h-4" />,
            href: '/app/class-types',
            done: (classTypes?.length ?? 0) > 0,
        },
        {
            id: 'instructors',
            label: 'Add Instructors',
            description: 'Set up your instructor roster with skills and availability.',
            icon: <Users className="w-4 h-4" />,
            href: '/app/instructors',
            done: (instructors?.length ?? 0) > 0,
        },
        {
            id: 'compatibility',
            label: 'Configure Compatibility Rules',
            description: 'Define which class types can substitute for each other during covers.',
            icon: <Puzzle className="w-4 h-4" />,
            href: '/app/compatibility',
            done: (rules?.length ?? 0) > 0,
        },
        {
            id: 'slots',
            label: 'Create Slot Templates',
            description: 'Define recurring weekly time slots (day, time, class type, instructor) used for week generation.',
            icon: <Clock className="w-4 h-4" />,
            href: '/app/slots',
            done: (slotTemplates?.length ?? 0) > 0,
        },
        {
            id: 'week',
            label: 'Generate Your First Week',
            description: 'Click "Generate Week" on the dashboard to create a schedule from your slot templates.',
            icon: <CalendarRange className="w-4 h-4" />,
            href: '/app',
            done: false,
        },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Getting Started</CardTitle>
                    <span className="text-xs font-medium text-slate-500">{completedCount}/{steps.length} complete</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {steps.map(step => (
                    <a
                        key={step.id}
                        href={step.href}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                            step.done
                                ? 'bg-green-50 border-green-100'
                                : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
                        }`}
                    >
                        <div className={`flex-shrink-0 ${step.done ? 'text-green-600' : 'text-slate-400'}`}>
                            {step.done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${step.done ? 'text-green-800 line-through' : 'text-slate-800'}`}>
                                {step.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                        </div>
                        <div className={`flex-shrink-0 ${step.done ? 'text-green-400' : 'text-slate-300'}`}>
                            {step.icon}
                        </div>
                        {!step.done && <ArrowRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    </a>
                ))}
            </CardContent>
        </Card>
    );
}
