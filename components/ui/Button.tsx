import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  fullWidth?: boolean
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary text-white shadow-lg shadow-primary/30',
  outline: 'border-2 border-primary text-primary',
  success: 'bg-success text-white shadow-lg shadow-success/20',
  ghost: 'text-on-surface-variant hover:bg-surface-container',
}

const sizeClasses: Record<string, string> = {
  sm: 'h-9 px-4 text-xs rounded-xl',
  md: 'h-12 px-6 text-sm rounded-xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
}

export default function Button({
  children, variant = 'primary', size = 'md', icon, fullWidth = false, className = '', ...props
}: ButtonProps) {
  return (
    <button
      className={`
        flex items-center justify-center gap-2 font-semibold transition-all active:scale-95
        ${variantClasses[variant]} ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  )
}