/**
 * SaveNameModal.tsx
 * ─────────────────
 * A small modal that prompts the user to give a name before saving
 * a project state. A default name is pre-filled with the current date/time.
 */

import { useState, useEffect, useRef } from 'react'
import { X, Save } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface SaveNameModalProps {
    open: boolean
    onClose: () => void
    onConfirm: (name: string) => void
    /** Whether the save is currently in progress */
    isSaving: boolean
}

function defaultName(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `State ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SaveNameModal({ open, onClose, onConfirm, isSaving }: SaveNameModalProps) {
    const { isDark } = useTheme()
    const [name, setName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset name each time the modal opens
    useEffect(() => {
        if (open) {
            setName(defaultName())
            // Focus & select-all after the next frame
            requestAnimationFrame(() => inputRef.current?.select())
        }
    }, [open])

    if (!open) return null

    const handleConfirm = () => {
        const trimmed = name.trim()
        if (!trimmed) return
        onConfirm(trimmed)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm()
        if (e.key === 'Escape') onClose()
    }

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Scrim */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className={`relative w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col gap-4 ${isDark ? 'bg-slate-900 border border-white/[0.08]' : 'bg-white border border-slate-200'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Save className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Save State
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                            }`}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Give this state a name so you can find and load it later.
                </p>

                {/* Name input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Draft v1 — sneaker last"
                    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors
            border focus:ring-2 focus:ring-indigo-500/50 ${isDark
                            ? 'bg-slate-800 border-white/10 text-white placeholder-slate-600 focus:border-indigo-500/50'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-300'
                        }`}
                />

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={handleConfirm}
                        disabled={!name.trim() || isSaving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium
              bg-indigo-500 hover:bg-indigo-600 text-white transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        Save
                    </button>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark
                                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
