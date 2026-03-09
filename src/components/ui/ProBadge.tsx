import { useTheme } from '@/hooks/useTheme'

interface ProBadgeProps {
  /** 'xs' — small overlay badge for toolbar icons; 'sm' — inline badge for text */
  size?: 'xs' | 'sm'
}

export function ProBadge({ size = 'sm' }: ProBadgeProps) {
  const { isDark } = useTheme()

  if (size === 'xs') {
    return (
      <span
        className={`absolute -top-1 -right-1 z-10 rounded-full px-[3px] py-[1px]
          text-[7px] font-extrabold tracking-wide leading-none pointer-events-none
          bg-amber-400 text-amber-900`}
      >
        PRO
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded px-1 py-0.5
        text-[9px] font-extrabold tracking-wider leading-none
        ${isDark ? 'bg-amber-400/20 text-amber-300' : 'bg-amber-100 text-amber-600'}`}
    >
      PRO
    </span>
  )
}
