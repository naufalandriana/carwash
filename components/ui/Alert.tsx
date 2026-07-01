'use client'

import { useState, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type AlertVariant = 'success' | 'error' | 'warning' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  message: string
  duration?: number // ms, 0 = tidak auto dismiss
  onClose?: () => void
  className?: string
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-500',
    text: 'text-green-800 dark:text-green-200',
    icon: 'check_circle',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
    icon: 'error',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
    icon: 'warning',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
    icon: 'info',
  },
}

export function Alert({
  variant = 'info',
  title,
  message,
  duration = 4000,
  onClose,
  className = '',
}: AlertProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        if (onClose) onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!visible) return null

  const styles = variantStyles[variant]

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 shadow-sm
        ${styles.bg} ${styles.border} ${styles.text}
        ${className}
      `}
      role="alert"
    >
      <span className="material-symbols-outlined text-[22px] flex-shrink-0">
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      <button
        onClick={() => {
          setVisible(false)
          if (onClose) onClose()
        }}
        className="flex-shrink-0 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
        aria-label="Tutup"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  )
}

// ─── Toast / Alert Container (buat floating alert) ───────────────────────

export interface ToastAlertProps extends AlertProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

const positionClasses: Record<NonNullable<ToastAlertProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
}

export function ToastAlert({
  position = 'top-right',
  ...props
}: ToastAlertProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className={`fixed z-50 w-full max-w-md ${positionClasses[position]} pointer-events-none`}>
      <div className="pointer-events-auto">
        <Alert {...props} />
      </div>
    </div>,
    document.body
  )
}

// ─── Context & Hook ──────────────────────────────────────────────────────

import { createContext, useContext, useCallback, useMemo } from 'react'

type AlertContextType = {
  showAlert: (props: Omit<ToastAlertProps, 'onClose'> & { onClose?: () => void }) => void
  hideAlert: () => void
}

const AlertContext = createContext<AlertContextType | null>(null)

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<Omit<ToastAlertProps, 'onClose'> & { onClose?: () => void } | null>(null)

  const showAlert = useCallback((props: Omit<ToastAlertProps, 'onClose'> & { onClose?: () => void }) => {
    setAlert(props)
  }, [])

  const hideAlert = useCallback(() => {
    setAlert(null)
  }, [])

  const value = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert])

  return (
    <AlertContext.Provider value={value}>
      {children}
      {alert && (
        <ToastAlert
          {...alert}
          onClose={() => {
            alert.onClose?.()
            hideAlert()
          }}
        />
      )}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}