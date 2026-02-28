import { Upload, FolderOpen } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface LastPanelProps {
  lastFile: string | File | null
  onFileChange: (file: File) => void
  onOpenLibrary: () => void
}

export function LastPanel({ lastFile, onFileChange, onOpenLibrary }: LastPanelProps) {
  const { isDark } = useTheme()

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileChange(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">Step 2: Load Last</h3>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Upload a shoe last model or select from the library
        </p>
      </div>

      {/* Upload */}
      <div>
        <label className={`text-xs font-medium mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Upload Model
        </label>
        <label
          className={`flex items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            isDark
              ? 'border-white/10 hover:border-indigo-500/50 hover:bg-white/5'
              : 'border-slate-200 hover:border-indigo-500/50 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".obj,.glb,.gltf,.stl"
            onChange={handleFileInput}
            className="hidden"
          />
          <Upload className="w-5 h-5 text-indigo-400" />
          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {lastFile
              ? typeof lastFile === 'string'
                ? lastFile
                : lastFile.name
              : 'OBJ, GLB, STL'}
          </span>
        </label>
      </div>

      {/* Library */}
      <button
        onClick={onOpenLibrary}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
          isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300'
            : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
        }`}
      >
        <FolderOpen className="w-4 h-4" />
        Select from Library
      </button>

      {lastFile && (
        <div
          className={`p-3 rounded-xl text-xs ${
            isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          Last model loaded successfully
        </div>
      )}
    </div>
  )
}
