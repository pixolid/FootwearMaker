import {
  Moon,
  Sun,
  PanelLeft,
  RotateCcw,
  BoxSelect,
  Eye,
  EyeOff,
  Ghost,
  Layers,
  Undo2,
  Redo2,
  Camera,
  LayoutGrid,
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { ActiveObject, CameraView } from '@/types/footwear'

interface ToolbarProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean

  // Per-active-object controls
  activeObject: ActiveObject
  /** Wireframe for the currently active object */
  isActiveWireframe: boolean
  onToggleWireframe: () => void
  /** Transparency for the currently active object */
  isActiveTransparent: boolean
  onToggleTransparency: () => void
  /** Visibility (show/hide) for the currently active object */
  isActiveHidden: boolean
  onToggleVisibility: () => void

  // Scene controls
  showGround: boolean
  onToggleGround: () => void

  // Camera
  onResetCamera: () => void
  onCameraView: (view: CameraView) => void

  // Undo/Redo
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  // Gallery sidebar
  gallerySidebarOpen: boolean
  onToggleGallerySidebar: () => void

  /** Only show active-object badges when in the Modify step */
  showActiveObjectControls: boolean
}

const CAMERA_VIEWS: { label: string; view: CameraView }[] = [
  { label: 'Perspective', view: 'perspective' },
  { label: 'Top', view: 'top' },
  { label: 'Bottom', view: 'bottom' },
  { label: 'Front', view: 'front' },
  { label: 'Back', view: 'back' },
  { label: 'Left', view: 'left' },
  { label: 'Right', view: 'right' },
]

export function Toolbar({
  onToggleSidebar,
  sidebarOpen,
  activeObject,
  isActiveWireframe,
  onToggleWireframe,
  isActiveTransparent,
  onToggleTransparency,
  isActiveHidden,
  onToggleVisibility,
  showGround,
  onToggleGround,
  onResetCamera,
  onCameraView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  gallerySidebarOpen,
  onToggleGallerySidebar,
  showActiveObjectControls,
}: ToolbarProps) {
  const { isDark, toggleTheme } = useTheme()
  const [showCameraMenu, setShowCameraMenu] = useState(false)

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">

      {/* Sidebar + Theme */}
      <PillGroup isDark={isDark}>
        <ToolbarButton
          icon={<PanelLeft className="w-5 h-5" />}
          onClick={onToggleSidebar}
          active={sidebarOpen}
          tooltip="Toggle sidebar"
          isDark={isDark}
        />
        <ToolbarButton
          icon={isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          onClick={toggleTheme}
          tooltip={isDark ? 'Light mode' : 'Dark mode'}
          isDark={isDark}
        />
        <ToolbarButton
          icon={<LayoutGrid className="w-5 h-5" />}
          onClick={onToggleGallerySidebar}
          active={gallerySidebarOpen}
          tooltip="3D Gallery"
          isDark={isDark}
        />
      </PillGroup>

      {/* Object display controls — wireframe, transparency, hide */}
      <PillGroup isDark={isDark}>
        {/* Wireframe (BoxSelect = box with dashed outline) — per active object */}
        <WithBadge show={showActiveObjectControls} label={activeObject} isDark={isDark}>
          <ToolbarButton
            icon={<BoxSelect className="w-5 h-5" />}
            onClick={onToggleWireframe}
            active={isActiveWireframe}
            tooltip={`Wireframe${showActiveObjectControls ? ` (${activeObject === 'A' ? 'Shoe' : 'Last'})` : ''}`}
            isDark={isDark}
          />
        </WithBadge>

        {/* Transparency — Ghost icon, per active object */}
        <WithBadge show={showActiveObjectControls} label={activeObject} isDark={isDark}>
          <ToolbarButton
            icon={<Ghost className="w-5 h-5" />}
            onClick={onToggleTransparency}
            active={isActiveTransparent}
            tooltip={`Transparent${showActiveObjectControls ? ` (${activeObject === 'A' ? 'Shoe' : 'Last'})` : ''}`}
            isDark={isDark}
          />
        </WithBadge>

        {/* Hide / Show — Eye icon, per active object */}
        <WithBadge show={showActiveObjectControls} label={activeObject} isDark={isDark}>
          <ToolbarButton
            icon={isActiveHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            onClick={onToggleVisibility}
            active={isActiveHidden}
            tooltip={`${isActiveHidden ? 'Show' : 'Hide'}${showActiveObjectControls ? ` (${activeObject === 'A' ? 'Shoe' : 'Last'})` : ''}`}
            isDark={isDark}
          />
        </WithBadge>

        {/* Ground plane toggle — Layers icon */}
        <ToolbarButton
          icon={<Layers className="w-5 h-5" />}
          onClick={onToggleGround}
          active={showGround}
          tooltip={showGround ? 'Hide ground' : 'Show ground'}
          isDark={isDark}
        />

        {/* Reset camera */}
        <ToolbarButton
          icon={<RotateCcw className="w-5 h-5" />}
          onClick={onResetCamera}
          tooltip="Reset camera"
          isDark={isDark}
        />

        {/* Camera views dropdown */}
        <div className="relative">
          <ToolbarButton
            icon={<Camera className="w-5 h-5" />}
            onClick={() => setShowCameraMenu(!showCameraMenu)}
            active={showCameraMenu}
            tooltip="Camera views"
            isDark={isDark}
          />
          {showCameraMenu && (
            <div
              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 py-2 rounded-xl backdrop-blur-xl shadow-2xl min-w-[140px] ${
                isDark
                  ? 'bg-slate-900/95'
                  : 'bg-slate-50/95'
              }`}
            >
              {CAMERA_VIEWS.map(({ label, view }) => (
                <button
                  key={view}
                  onClick={() => {
                    onCameraView(view)
                    setShowCameraMenu(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    isDark
                      ? 'hover:bg-white/10 text-slate-200'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </PillGroup>

      {/* Undo / Redo */}
      <PillGroup isDark={isDark}>
        <ToolbarButton
          icon={<Undo2 className="w-5 h-5" />}
          onClick={onUndo}
          disabled={!canUndo}
          tooltip="Undo"
          isDark={isDark}
        />
        <ToolbarButton
          icon={<Redo2 className="w-5 h-5" />}
          onClick={onRedo}
          disabled={!canRedo}
          tooltip="Redo"
          isDark={isDark}
        />
      </PillGroup>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PillGroup({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-2xl backdrop-blur-xl shadow-2xl ${
        isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
      }`}
    >
      {children}
    </div>
  )
}

/** Wraps a button with a small A/B badge in the top-right corner */
function WithBadge({
  show,
  label,
  isDark,
  children,
}: {
  show: boolean
  label: ActiveObject
  isDark: boolean
  children: React.ReactNode
}) {
  if (!show) return <>{children}</>
  return (
    <div className="relative">
      {children}
      <span
        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold
          flex items-center justify-center pointer-events-none
          ${isDark
            ? 'bg-slate-700 text-slate-300 border border-white/10'
            : 'bg-white text-slate-600 border border-slate-200'
          }`}
      >
        {label === 'A' ? 'S' : 'L'}
      </span>
    </div>
  )
}

interface ToolbarButtonProps {
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tooltip: string
  isDark: boolean
}

function ToolbarButton({ icon, onClick, active, disabled, tooltip, isDark }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
        hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
        ${active
          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
          : isDark
            ? 'hover:bg-white/10 text-slate-300'
            : 'hover:bg-slate-200/60 text-slate-600'
        }`}
    >
      {icon}
    </button>
  )
}
