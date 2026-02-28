import { useState, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { X, Download, Loader2, ChevronDown, Box, Trash2 } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { getUserFiles, deleteFile, type StorageFile } from '@/firebase/storage'

interface GallerySidebarProps {
  open: boolean
  onClose: () => void
  userId: string
  refreshTrigger: number
}

export function GallerySidebar({ open, onClose, userId, refreshTrigger }: GallerySidebarProps) {
  const { isDark } = useTheme()
  const [files, setFiles] = useState<StorageFile[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<StorageFile | null>(null)

  // Load files when sidebar opens or refreshTrigger changes
  useEffect(() => {
    if (!open) return
    setLoading(true)
    getUserFiles(userId, 'models')
      .then(setFiles)
      .finally(() => setLoading(false))
  }, [open, userId, refreshTrigger])

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return
    const handleClick = () => setOpenDropdown(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [openDropdown])

  const handleDownloadGLB = useCallback((file: StorageFile) => {
    const a = document.createElement('a')
    a.href = file.url
    a.download = file.name
    a.target = '_blank'
    a.click()
  }, [])

  const handleDownloadConverted = useCallback(async (file: StorageFile, format: 'stl' | 'obj') => {
    setDownloadingId(`${file.fullPath}-${format}`)
    try {
      const { loadModelFromURL, exportToSTL, exportToOBJ } = await import('@/utils/meshHelpers')
      const geometry = await loadModelFromURL(file.url, file.name)
      const mesh = new THREE.Mesh(geometry)
      const outName = file.name.replace(/\.[^/.]+$/, `.${format}`)

      if (format === 'stl') {
        exportToSTL(mesh, outName)
      } else {
        await exportToOBJ(mesh, outName)
      }
    } catch (error) {
      console.error(`Failed to convert to ${format}:`, error)
    } finally {
      setDownloadingId(null)
      setOpenDropdown(null)
    }
  }, [])

  const handleDelete = useCallback(async (file: StorageFile) => {
    setConfirmDeleteFile(null)
    setDeletingId(file.fullPath)
    try {
      // Delete model file
      await deleteFile(file.fullPath)
      // Delete thumbnail if present (replace 'models/' with 'models/thumbnails/' and append _thumb.png)
      if (file.thumbnailUrl) {
        const thumbPath = file.fullPath
          .replace(/^(.*\/)([^/]+)(\.[^.]+)$/, '$1thumbnails/$2_thumb.png')
        try { await deleteFile(thumbPath) } catch { /* thumbnail may not exist, ignore */ }
      }
      setFiles((prev) => prev.filter((f) => f.fullPath !== file.fullPath))
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeletingId(null)
    }
  }, [])

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <div
      className={`absolute top-0 right-0 h-full z-40 transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ width: '340px' }}
    >
      <div
        className={`relative w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${
          isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Box className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-semibold text-sm">3D Gallery</span>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete confirmation dialog */}
        {confirmDeleteFile && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <div
              className={`w-full max-w-[280px] rounded-2xl p-5 shadow-2xl ${
                isDark ? 'bg-slate-800 border border-white/10' : 'bg-white border border-slate-200'
              }`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/15 mb-4 mx-auto">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <p className={`text-sm font-semibold text-center mb-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                Delete model?
              </p>
              <p className={`text-xs text-center mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                "{confirmDeleteFile.name}" will be permanently removed.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteFile(null)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  No
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteFile)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors bg-red-500 hover:bg-red-600 text-white"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Loading models…
              </span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isDark ? 'bg-white/5' : 'bg-slate-100'
              }`}>
                <Box className={`w-6 h-6 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              </div>
              <div className="text-center">
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  No models saved yet
                </p>
                <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Saved models will appear here
                </p>
              </div>
            </div>
          ) : (
            files.map((file) => (
              <GalleryItem
                key={file.fullPath}
                file={file}
                isDark={isDark}
                isDownloading={downloadingId?.startsWith(file.fullPath) ?? false}
                isDeleting={deletingId === file.fullPath}
                dropdownOpen={openDropdown === file.fullPath}
                onToggleDropdown={(e) => {
                  e.stopPropagation()
                  setOpenDropdown(openDropdown === file.fullPath ? null : file.fullPath)
                }}
                onDownloadGLB={() => handleDownloadGLB(file)}
                onDownloadSTL={() => handleDownloadConverted(file, 'stl')}
                onDownloadOBJ={() => handleDownloadConverted(file, 'obj')}
                onDeleteRequest={() => setConfirmDeleteFile(file)}
                formatDate={formatDate}
              />
            ))
          )}
        </div>

        {/* Footer — item count */}
        {!loading && files.length > 0 && (
          <div
            className={`flex items-center justify-between px-4 py-3 border-t ${
              isDark ? 'border-white/[0.06]' : 'border-slate-200'
            }`}
          >
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {files.length} {files.length === 1 ? 'model' : 'models'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Gallery Item ──────────────────────────────────────────────────────────────

interface GalleryItemProps {
  file: StorageFile
  isDark: boolean
  isDownloading: boolean
  isDeleting: boolean
  dropdownOpen: boolean
  onToggleDropdown: (e: React.MouseEvent) => void
  onDownloadGLB: () => void
  onDownloadSTL: () => void
  onDownloadOBJ: () => void
  onDeleteRequest: () => void
  formatDate: (timestamp: number) => string
}

function GalleryItem({
  file,
  isDark,
  isDownloading,
  isDeleting,
  dropdownOpen,
  onToggleDropdown,
  onDownloadGLB,
  onDownloadSTL,
  onDownloadOBJ,
  onDeleteRequest,
  formatDate,
}: GalleryItemProps) {
  const ext = file.name.split('.').pop()?.toUpperCase() || '3D'

  return (
    <div
      className={`rounded-xl overflow-hidden transition-colors ${
        isDark ? 'bg-white/5 hover:bg-white/[0.07]' : 'bg-white hover:bg-slate-50/80'
      }`}
    >
      {/* Thumbnail or placeholder */}
      <div className="w-full h-32 relative overflow-hidden">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              isDark ? 'bg-white/[0.03]' : 'bg-slate-100'
            }`}
          >
            <div className="text-center">
              <Box className={`w-8 h-8 mx-auto mb-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <span className={`text-[10px] font-bold ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                {ext}
              </span>
            </div>
          </div>
        )}
        {/* Format badge */}
        <span
          className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
            isDark
              ? 'bg-slate-900/80 text-slate-300'
              : 'bg-white/90 text-slate-500'
          }`}
        >
          {ext}
        </span>
      </div>

      {/* Info + actions */}
      <div className={`p-3 flex items-center gap-2 border-t ${
        isDark ? 'border-white/[0.04]' : 'border-slate-100'
      }`}>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {file.name}
          </p>
          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {formatDate(file.createdAt)}
          </p>
        </div>

        {/* Download dropdown */}
        <div className="relative">
          <button
            onClick={onToggleDropdown}
            disabled={isDownloading || isDeleting}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDownloading
                ? 'opacity-50 cursor-wait'
                : isDark
                  ? 'hover:bg-white/10 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <div className="flex items-center">
                <Download className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 -ml-0.5" />
              </div>
            )}
          </button>

          {dropdownOpen && (
            <div
              className={`absolute right-0 bottom-full mb-2 py-1.5 rounded-xl backdrop-blur-xl shadow-2xl min-w-[120px] z-50 ${
                isDark ? 'bg-slate-900/95 border border-white/[0.06]' : 'bg-slate-50/95 border border-slate-200'
              }`}
            >
              {(['GLB', 'STL', 'OBJ'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (fmt === 'GLB') onDownloadGLB()
                    else if (fmt === 'STL') onDownloadSTL()
                    else onDownloadOBJ()
                  }}
                  className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors flex items-center gap-2 ${
                    isDark
                      ? 'hover:bg-white/10 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Download className="w-3 h-3" />
                  .{fmt.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteRequest() }}
          disabled={isDeleting || isDownloading}
          title="Delete model"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isDeleting
              ? 'opacity-50 cursor-wait'
              : isDark
                ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400'
                : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
          }`}
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}
