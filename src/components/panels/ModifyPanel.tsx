import { useState } from 'react'
import {
  Move,
  RotateCw,
  Maximize2,
  Grid3x3,
  FlipHorizontal,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import type { TransformMode, ActiveObject, FFDSettings } from '@/types/footwear'

interface ModifyPanelProps {
  transformMode: TransformMode
  onTransformModeChange: (mode: TransformMode) => void
  activeObject: ActiveObject
  onActiveObjectChange: (obj: ActiveObject) => void
  showFFDGrid: boolean
  onToggleFFDGrid: () => void
  ffdSettingsA: FFDSettings
  ffdSettingsB: FFDSettings
  onFFDSettingsChangeA: (settings: FFDSettings) => void
  onFFDSettingsChangeB: (settings: FFDSettings) => void
  onResetFFDGrid: () => void
  onResetFFD: () => void
  onMirrorX: () => void
  onMirrorY: () => void
  onMirrorZ: () => void
  onRotate90X: () => void
  onRotate90Y: () => void
  onRotate90Z: () => void
}

export function ModifyPanel({
  transformMode,
  onTransformModeChange,
  activeObject,
  onActiveObjectChange,
  showFFDGrid,
  onToggleFFDGrid,
  ffdSettingsA,
  ffdSettingsB,
  onFFDSettingsChangeA,
  onFFDSettingsChangeB,
  onResetFFDGrid,
  onResetFFD,
  onMirrorX,
  onMirrorY,
  onMirrorZ,
  onRotate90X,
  onRotate90Y,
  onRotate90Z,
}: ModifyPanelProps) {
  const { isDark } = useTheme()
  const [ffdExpanded, setFfdExpanded] = useState(false)
  const currentFFD = activeObject === 'A' ? ffdSettingsA : ffdSettingsB
  const onFFDChange = activeObject === 'A' ? onFFDSettingsChangeA : onFFDSettingsChangeB

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Step 3: Modify</h3>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Transform and deform your meshes
        </p>
      </div>

      {/* Active Object Toggle */}
      <div>
        <label className={`text-xs font-medium mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Active Object
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['A', 'B'] as const).map((obj) => (
            <button
              key={obj}
              onClick={() => onActiveObjectChange(obj)}
              className={`py-2 rounded-xl text-xs font-medium transition-all ${
                activeObject === obj
                  ? 'bg-indigo-500 text-white'
                  : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {obj === 'A' ? 'Shoe' : 'Last'}
            </button>
          ))}
        </div>
      </div>

      {/* Transform Mode */}
      <div>
        <label className={`text-xs font-medium mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Transform Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { mode: 'translate' as TransformMode, icon: Move, label: 'Move' },
            { mode: 'rotate' as TransformMode, icon: RotateCw, label: 'Rotate' },
            { mode: 'scale' as TransformMode, icon: Maximize2, label: 'Scale' },
          ] as const).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onTransformModeChange(mode)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                transformMode === mode
                  ? 'bg-indigo-500 text-white'
                  : isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* FFD Controls */}
      <div>
        <label className={`text-xs font-medium mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          FFD Deformation
        </label>
        <button
          onClick={onToggleFFDGrid}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all mb-2 ${
            showFFDGrid
              ? 'bg-indigo-500 text-white'
              : isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Grid3x3 className="w-4 h-4" />
          FFD Deformation
        </button>

        {/* Collapsible FFD Settings */}
        <button
          onClick={() => setFfdExpanded((p) => !p)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all mb-2 ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-slate-300'
              : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
        >
          <span>FFD Settings</span>
          {ffdExpanded
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />
          }
        </button>

        {ffdExpanded && (
          <div className="space-y-3">
            {(['lengthSubdivisions', 'heightSubdivisions', 'widthSubdivisions'] as const).map((key) => {
              const labels: Record<string, string> = {
                lengthSubdivisions: 'X-Axis',
                heightSubdivisions: 'Z-Axis',
                widthSubdivisions: 'Y-Axis',
              }
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {labels[key]}
                    </span>
                    <span className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {currentFFD[key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={currentFFD[key]}
                    onChange={(e) =>
                      onFFDChange({ ...currentFFD, [key]: parseInt(e.target.value) })
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                      [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-md
                      bg-slate-600/30"
                  />
                </div>
              )
            })}

            <button
              onClick={onResetFFDGrid}
              className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              Reset FFD Grid ({activeObject === 'A' ? 'Shoe' : 'Last'})
            </button>
            <button
              onClick={onResetFFD}
              className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              Reset All Deformation ({activeObject === 'A' ? 'Shoe' : 'Last'})
            </button>
          </div>
        )}
      </div>

      {/* Quick Tools */}
      <div>
        <label className={`text-xs font-medium mb-2 block ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Quick Tools
        </label>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={onMirrorX} className={quickBtnClass(isDark)}>
              <FlipHorizontal className="w-3.5 h-3.5" />
              Mirror X
            </button>
            <button onClick={onMirrorY} className={quickBtnClass(isDark)}>
              <FlipHorizontal className="w-3.5 h-3.5" />
              Mirror Y
            </button>
            <button onClick={onMirrorZ} className={quickBtnClass(isDark)}>
              <FlipHorizontal className="w-3.5 h-3.5" />
              Mirror Z
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={onRotate90X} className={quickBtnClass(isDark)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Rot X
            </button>
            <button onClick={onRotate90Y} className={quickBtnClass(isDark)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Rot Y
            </button>
            <button onClick={onRotate90Z} className={quickBtnClass(isDark)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Rot Z
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function quickBtnClass(isDark: boolean) {
  return `flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-medium transition-all ${
    isDark
      ? 'bg-white/5 hover:bg-white/10 text-slate-300'
      : 'bg-slate-200 hover:bg-slate-100 text-slate-600'
  }`
}
