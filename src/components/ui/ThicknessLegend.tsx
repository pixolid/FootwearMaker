import { useTheme } from '@/hooks/useTheme'

const LEGEND_BANDS = [
  { label: '≥ 5.0 mm',  color: '#00ff88' },
  { label: '4.0–4.9 mm', color: '#88ff00' },
  { label: '3.0–4.0 mm', color: '#ffee00' },
  { label: '2.0–3.0 mm', color: '#ff8800' },
  { label: '1.0–2.0 mm', color: '#ff2200' },
  { label: '0.0–1.0 mm', color: '#ff0066' },
  { label: '0.0 mm',     color: '#8800cc' },
]

/**
 * Floating legend overlay for the thickness heatmap.
 * Absolute-positioned bottom-right over the viewport.
 * pointer-events-none so it doesn't interfere with orbit controls.
 */
export function ThicknessLegend() {
  const { isDark } = useTheme()

  return (
    <div
      className={`absolute bottom-24 right-4 z-40 pointer-events-none
        rounded-xl backdrop-blur-xl shadow-2xl p-3
        ${isDark ? 'bg-slate-900/90' : 'bg-slate-50/90'}`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2
        ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Thickness
      </p>
      <div className="flex flex-col gap-1">
        {LEGEND_BANDS.map((band) => (
          <div key={band.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0 border border-white/10"
              style={{ backgroundColor: band.color }}
            />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {band.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
