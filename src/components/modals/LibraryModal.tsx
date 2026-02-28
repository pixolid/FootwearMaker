import { useState, useEffect } from 'react'
import { X, Upload, Loader2, Trash2, Download, Globe, Lock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { getUserFiles, getPublicFiles, deleteFile, uploadFile, type StorageFile } from '@/firebase/storage'

interface LibraryModalProps {
  open: boolean
  onClose: () => void
  userId: string
  /** Storage category path, e.g. 'shoes' or 'lasts' */
  category: string
  title: string
  /** Called when user picks a file from the library */
  onSelect: (url: string, name: string) => void
  /** Called when user uploads a new file (also loads it into viewport) */
  onUpload: (file: File) => void
  acceptedFormats?: string
}

export function LibraryModal({
  open,
  onClose,
  userId,
  category,
  title,
  onSelect,
  onUpload,
  acceptedFormats = '.obj,.glb,.gltf,.stl',
}: LibraryModalProps) {
  const { isDark } = useTheme()
  const [publicItems, setPublicItems] = useState<StorageFile[]>([])
  const [privateItems, setPrivateItems] = useState<StorageFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getPublicFiles(category),
      getUserFiles(userId, category),
    ])
      .then(([pub, priv]) => {
        setPublicItems(pub)
        setPrivateItems(priv)
      })
      .finally(() => setLoading(false))
  }, [open, userId, category])

  const handleDelete = async (item: StorageFile) => {
    setDeleting(item.fullPath)
    try {
      await deleteFile(item.fullPath)
      setPrivateItems((prev) => prev.filter((i) => i.fullPath !== item.fullPath))
    } catch (e) {
      console.error('Delete failed', e)
    } finally {
      setDeleting(null)
    }
  }

  const MAX_UPLOAD_MB = 50
  const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`File is too large. Please upload a file smaller than ${MAX_UPLOAD_MB} MB.`)
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      // Upload to private storage so it appears in "My Models"
      const url = await uploadFile(file, userId, category)
      // Add to private items list immediately
      setPrivateItems((prev) => [
        {
          name: file.name,
          url,
          fullPath: `users/${userId}/${category}/${Date.now()}-${file.name}`,
          createdAt: Date.now(),
        },
        ...prev,
      ])
      // Also load into the 3D viewport and close modal
      onUpload(file)
      onClose()
    } catch (e) {
      console.error('Upload failed', e)
    } finally {
      setUploading(false)
    }
  }

  const handleSelect = (url: string, name: string) => {
    onSelect(url, name)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-4 rounded-2xl border shadow-2xl flex flex-col overflow-hidden
          ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}
        `}
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="p-5 space-y-7">

              {/* ── Public Library Section ─────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    FootwearMaker Library
                  </h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {publicItems.length}
                  </span>
                </div>

                {publicItems.length === 0 ? (
                  <EmptyState isDark={isDark} message="No public models available yet." />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {publicItems.map((item) => (
                      <LibraryCard
                        key={item.fullPath}
                        item={item}
                        isDark={isDark}
                        isDeleting={false}
                        showDelete={false}
                        showDownload={false}
                        onSelect={() => handleSelect(item.url, item.name)}
                        onDelete={() => {}}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Divider */}
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`} />

              {/* ── Private / My Models Section ───────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    My Models
                  </h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {privateItems.length}
                  </span>
                </div>

                {/* Upload button */}
                <label className={`block mb-3 ${uploading ? 'cursor-wait' : 'cursor-pointer'}`}>
                  <input
                    type="file"
                    accept={acceptedFormats}
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={uploading}
                  />
                  <div
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                      border-2 border-dashed ${
                        isDark
                          ? 'border-white/10 hover:border-indigo-500/50 hover:bg-white/5 text-slate-300'
                          : 'border-slate-200 hover:border-indigo-500/50 hover:bg-slate-50 text-slate-600'
                      }`}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-indigo-400" />
                    )}
                    {uploading ? 'Uploading…' : 'Upload model (.glb recommended)'}
                  </div>
                </label>

                {privateItems.length === 0 ? (
                  <EmptyState isDark={isDark} message="No private models yet. Upload your first model above." />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {privateItems.map((item) => (
                      <LibraryCard
                        key={item.fullPath}
                        item={item}
                        isDark={isDark}
                        isDeleting={deleting === item.fullPath}
                        showDelete={true}
                        showDownload={true}
                        onSelect={() => handleSelect(item.url, item.name)}
                        onDelete={() => handleDelete(item)}
                      />
                    ))}
                  </div>
                )}
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ isDark, message }: { isDark: boolean; message: string }) {
  return (
    <div className={`text-center py-8 rounded-xl border border-dashed ${
      isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
    }`}>
      <p className="text-xs">{message}</p>
    </div>
  )
}

interface LibraryCardProps {
  item: StorageFile
  isDark: boolean
  isDeleting: boolean
  showDelete: boolean
  showDownload: boolean
  onSelect: () => void
  onDelete: () => void
}

function LibraryCard({ item, isDark, isDeleting, showDelete, showDownload, onSelect, onDelete }: LibraryCardProps) {
  const ext = item.name.split('.').pop()?.toUpperCase() ?? '3D'
  const displayName = item.name.replace(/^\d+-/, '').split('.')[0]

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border overflow-hidden group transition-all cursor-pointer ${
        isDark
          ? 'bg-white/5 border-white/10 hover:border-indigo-500/40'
          : 'bg-slate-50 border-slate-200 hover:border-indigo-400'
      }`}
    >
      {/* Thumbnail area */}
      <div
        className={`w-full h-32 relative overflow-hidden ${
          isDark ? 'bg-white/[0.04]' : 'bg-slate-100'
        }`}
      >
        {item.thumbnailUrl ? (
          <>
            <img
              src={item.thumbnailUrl}
              alt={displayName}
              className="w-full h-full object-cover block"
            />
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="text-white text-[10px] font-medium bg-black/50 px-2 py-0.5 rounded-full">
                Click to load
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span
              className={`text-xl font-bold tabular-nums ${
                isDark ? 'text-indigo-400' : 'text-indigo-500'
              }`}
            >
              {ext}
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Click to load
            </span>
          </div>
        )}
      </div>

      {/* Footer — stop propagation so download/delete don't trigger card click */}
      <div
        className={`flex items-center justify-between px-2.5 py-2 border-t ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {displayName}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {showDownload && (
            <a
              href={item.url}
              download={item.name}
              onClick={(e) => e.stopPropagation()}
              title="Download"
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
          {showDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={isDeleting}
              title="Delete"
              className={`p-1.5 rounded-lg transition-colors ${
                isDark
                  ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400'
                  : 'hover:bg-red-50 text-slate-500 hover:text-red-500'
              }`}
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
