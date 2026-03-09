/**
 * SavedStatesSidebar.tsx
 * ──────────────────────
 * Right-side slide-in panel for managing saved project states.
 * Modelled on GallerySidebar.tsx — same animation, styling, and z-index pattern.
 */

import { useState, useEffect, useCallback } from 'react'
import { X, FolderOpen, Trash2, Loader2, BookMarked, AlertCircle } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { getSavedStates, type SavedStateEntry } from '@/firebase/storage'

// ── Props ─────────────────────────────────────────────────────────────────────

interface SavedStatesSidebarProps {
    open: boolean
    onClose: () => void
    userId: string
    refreshTrigger: number
    onLoad: (stateId: string) => Promise<void>
    onDelete: (stateId: string) => Promise<void>
}

// ── Helper: format date ───────────────────────────────────────────────────────

function formatDate(ts: number): string {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SavedStatesSidebar({
    open,
    onClose,
    userId,
    refreshTrigger,
    onLoad,
    onDelete,
}: SavedStatesSidebarProps) {
    const { isDark } = useTheme()

    const [entries, setEntries] = useState<SavedStateEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    // Load entries whenever the sidebar opens or refreshTrigger changes
    const fetchEntries = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getSavedStates(userId)
            setEntries(data)
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        if (open) fetchEntries()
    }, [open, refreshTrigger, fetchEntries])

    const handleLoad = useCallback(
        async (id: string) => {
            setLoadingId(id)
            try {
                await onLoad(id)
                onClose()
            } finally {
                setLoadingId(null)
            }
        },
        [onLoad, onClose],
    )

    const handleDeleteConfirm = useCallback(
        async (id: string) => {
            setDeletingId(id)
            setConfirmDeleteId(null)
            try {
                await onDelete(id)
                setEntries((prev) => prev.filter((e) => e.id !== id))
            } finally {
                setDeletingId(null)
            }
        },
        [onDelete],
    )

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div
            className={`absolute top-0 right-0 h-full z-40 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'
                }`}
            style={{ width: '340px' }}
        >
            <div
                className={`w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
                    }`}
            >
                {/* Header */}
                <div
                    className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <BookMarked
                            className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                        />
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Saved States
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Loading saved states…
                            </span>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
                            <BookMarked className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                No saved states yet. Use the{' '}
                                <strong className={isDark ? 'text-slate-300' : 'text-slate-600'}>Save State</strong>{' '}
                                button to save your current project.
                            </p>
                        </div>
                    ) : (
                        entries.map((entry) => (
                            <SavedStateCard
                                key={entry.id}
                                entry={entry}
                                isDark={isDark}
                                isLoading={loadingId === entry.id}
                                isDeleting={deletingId === entry.id}
                                confirmingDelete={confirmDeleteId === entry.id}
                                onLoad={() => handleLoad(entry.id)}
                                onRequestDelete={() =>
                                    setConfirmDeleteId((prev) => (prev === entry.id ? null : entry.id))
                                }
                                onConfirmDelete={() => handleDeleteConfirm(entry.id)}
                                onCancelDelete={() => setConfirmDeleteId(null)}
                            />
                        ))
                    )}
                </div>

                {/* Footer */}
                <div
                    className={`p-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}
                >
                    <p className={`text-[10px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        {entries.length} saved {entries.length === 1 ? 'state' : 'states'}
                    </p>
                </div>
            </div>
        </div>
    )
}

// ── Card sub-component ────────────────────────────────────────────────────────

interface SavedStateCardProps {
    entry: SavedStateEntry
    isDark: boolean
    isLoading: boolean
    isDeleting: boolean
    confirmingDelete: boolean
    onLoad: () => void
    onRequestDelete: () => void
    onConfirmDelete: () => void
    onCancelDelete: () => void
}

function SavedStateCard({
    entry,
    isDark,
    isLoading,
    isDeleting,
    confirmingDelete,
    onLoad,
    onRequestDelete,
    onConfirmDelete,
    onCancelDelete,
}: SavedStateCardProps) {
    const { metadata, thumbnailUrl } = entry

    const stepLabel: Record<number, string> = {
        1: 'Shoe',
        2: 'Last',
        3: 'Modify',
        4: 'Result',
    }

    return (
        <div
            className={`rounded-xl overflow-hidden border transition-all ${isDark
                    ? 'bg-slate-800/60 border-white/[0.06] hover:border-indigo-500/30'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
        >
            {/* Thumbnail */}
            <div
                className={`relative w-full aspect-video flex items-center justify-center ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'
                    }`}
            >
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={metadata.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <BookMarked className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                )}

                {/* Step badge */}
                <div className="absolute top-2 left-2">
                    <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${isDark
                                ? 'bg-slate-900/80 text-indigo-400 backdrop-blur-sm'
                                : 'bg-white/90 text-indigo-600 backdrop-blur-sm'
                            }`}
                    >
                        Step: {stepLabel[metadata.currentStep] ?? metadata.currentStep}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <p
                    className={`text-sm font-semibold truncate mb-0.5 ${isDark ? 'text-white' : 'text-slate-800'
                        }`}
                >
                    {metadata.name}
                </p>
                <p className={`text-[10px] mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatDate(metadata.savedAt)}
                </p>

                {/* Model labels */}
                <div className="flex gap-1 flex-wrap mb-3">
                    {metadata.shoeFileName && (
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                                }`}
                        >
                            Shoe: {metadata.shoeFileName}
                        </span>
                    )}
                    {metadata.lastFileName && (
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                }`}
                        >
                            Last: {metadata.lastFileName}
                        </span>
                    )}
                </div>

                {/* Confirm-delete warning */}
                {confirmingDelete && (
                    <div
                        className={`rounded-lg p-2 mb-2 flex items-start gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                            }`}
                    >
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <p className={`text-[10px] leading-relaxed ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                            Delete this state permanently? This cannot be undone.
                        </p>
                    </div>
                )}

                {/* Action buttons */}
                {confirmingDelete ? (
                    <div className="flex gap-2">
                        <button
                            onClick={onConfirmDelete}
                            disabled={isDeleting}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium
                bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Trash2 className="w-3 h-3" />
                            )}
                            Delete
                        </button>
                        <button
                            onClick={onCancelDelete}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark
                                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                }`}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={onLoad}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium
                bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <FolderOpen className="w-3 h-3" />
                            )}
                            Load
                        </button>
                        <button
                            onClick={onRequestDelete}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark
                                    ? 'bg-white/5 hover:bg-red-500/15 text-slate-400 hover:text-red-400'
                                    : 'bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500'
                                }`}
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
