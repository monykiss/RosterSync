"use client";

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SKELETON_SLOTS = 5;

function ShimmerBlock({ className }: { className?: string }) {
    return (
        <div className={`animate-pulse bg-slate-200 rounded ${className ?? ''}`} />
    );
}

export function PlannerSkeleton() {
    return (
        <div className="flex flex-col h-full">
            {/* Skeleton Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
                <div className="space-y-2">
                    <ShimmerBlock className="h-7 w-56" />
                    <ShimmerBlock className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                    <ShimmerBlock className="h-5 w-20 rounded-full" />
                    <ShimmerBlock className="h-9 w-32 rounded-md" />
                </div>
            </div>

            {/* Skeleton Readiness Bar */}
            <div className="px-6 py-2.5 border-b bg-slate-50/50 flex items-center justify-between">
                <div className="flex gap-5">
                    <ShimmerBlock className="h-4 w-24" />
                    <ShimmerBlock className="h-4 w-28" />
                    <ShimmerBlock className="h-4 w-20" />
                </div>
                <ShimmerBlock className="h-5 w-32 rounded-full" />
            </div>

            {/* Skeleton Legend */}
            <div className="px-6 py-2 bg-slate-50 border-b flex gap-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <ShimmerBlock key={i} className="h-3 w-20" />
                ))}
            </div>

            {/* Skeleton Grid */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                <div className="w-full bg-white rounded-lg border shadow-sm">
                    <div className="min-w-[800px]">
                        {/* Header */}
                        <div className="grid grid-cols-[100px_repeat(7,_1fr)] border-b bg-slate-50">
                            <div className="p-3 border-r">
                                <ShimmerBlock className="h-4 w-10" />
                            </div>
                            {DAY_LABELS.map(day => (
                                <div key={day} className="p-3 text-center border-r last:border-0">
                                    <span className="text-sm font-semibold text-slate-700">{day}</span>
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {Array.from({ length: SKELETON_SLOTS }).map((_, slotIdx) => (
                            <div key={slotIdx} className="grid grid-cols-[100px_repeat(7,_1fr)] border-b last:border-0">
                                <div className="p-3 border-r bg-slate-50 flex items-start">
                                    <ShimmerBlock className="h-4 w-12" />
                                </div>
                                {DAY_LABELS.map((_, dayIdx) => (
                                    <div key={dayIdx} className="p-2 border-r last:border-0 min-h-[100px]">
                                        {(slotIdx + dayIdx) % 3 === 0 && (
                                            <div className="p-2.5 rounded-md border border-slate-100 space-y-1.5">
                                                <ShimmerBlock className="h-3 w-16" />
                                                <ShimmerBlock className="h-4 w-24" />
                                                <ShimmerBlock className="h-3 w-20" />
                                                <ShimmerBlock className="h-4 w-16 rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
