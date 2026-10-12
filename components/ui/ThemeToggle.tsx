'use client'

import { useTheme } from '@/lib/theme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle, mounted } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`w-9 h-9 flex items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container active:bg-surface-container-high text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors shrink-0 ${className}`}
    >
      {/* keep layout stable, swap icons without shifting */}
      <span className="relative w-[20px] h-[20px] flex items-center justify-center overflow-hidden">
        <span
          aria-hidden
          className={`material-symbols-outlined absolute text-[20px] leading-none transition-all duration-200 ${mounted && !isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 rotate-90'}`}
        >
          light_mode
        </span>
        <span
          aria-hidden
          className={`material-symbols-outlined absolute text-[20px] leading-none transition-all duration-200 ${mounted && isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-90'}`}
        >
          dark_mode
        </span>
        {/* SSR fallback before mount: show light icon */}
        {!mounted && (
          <span aria-hidden className="material-symbols-outlined absolute text-[20px] leading-none">
            light_mode
          </span>
        )}
      </span>
    </button>
  )
}
