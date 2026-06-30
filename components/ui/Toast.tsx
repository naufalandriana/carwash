'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  success?: boolean
  visible: boolean
  onHide: () => void
}

export default function Toast({ message, success = true, visible, onHide }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 2500)
      return () => clearTimeout(t)
    }
  }, [visible, onHide])

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] transition-all duration-300 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-3 bg-on-surface text-surface-container-lowest px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold whitespace-nowrap">
        <span className={`material-symbols-outlined text-[18px] ${success ? 'text-green-400' : 'text-red-400'}`}>
          {success ? 'check_circle' : 'error'}
        </span>
        <span>{message}</span>
      </div>
    </div>
  )
}