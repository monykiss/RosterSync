"use client";

interface ShortcutEntry {
    keys: string[];
    description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
    { keys: ['?'], description: 'Toggle this help overlay' },
    { keys: ['Esc'], description: 'Close drawer, modal, or deselect all' },
    { keys: ['P'], description: 'Open publish modal' },
    { keys: ['A'], description: 'Select all sessions' },
    { keys: ['D'], description: 'Deselect all sessions' },
    { keys: ['←', '→', '↑', '↓'], description: 'Navigate between sessions in grid' },
    { keys: ['Enter'], description: 'Open focused session details' },
    { keys: ['Cmd/Ctrl', 'Click'], description: 'Toggle session selection' },
];

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
            onClick={onClose}
            role="dialog"
            aria-label="Keyboard shortcuts"
        >
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3.5 border-b">
                    <h2 className="font-semibold text-slate-900">Keyboard Shortcuts</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-sm"
                        aria-label="Close"
                    >
                        Esc
                    </button>
                </div>
                <div className="p-5 space-y-2.5">
                    {SHORTCUTS.map((shortcut, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-slate-600">{shortcut.description}</span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, j) => (
                                    <span key={j}>
                                        <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono text-slate-700">
                                            {key}
                                        </kbd>
                                        {j < shortcut.keys.length - 1 && (
                                            <span className="text-slate-400 text-xs mx-0.5">+</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-5 py-3 border-t bg-slate-50 rounded-b-lg">
                    <p className="text-xs text-slate-400 text-center">
                        Press <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-[10px] font-mono">?</kbd> anytime to toggle this overlay
                    </p>
                </div>
            </div>
        </div>
    );
}
