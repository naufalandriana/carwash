import { ReactNode } from 'react'

interface StatCardProps {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  value: string
  sub: string
  subColor?: string
  variant?: 'primary' | 'default'
  badge?: string
}

export default function StatCard({
  icon, iconBg, iconColor, label, value, sub, subColor = 'text-on-surface-variant',
  variant = 'default', badge,
}: StatCardProps) {
  if (variant === 'primary') {
    return (
      <div className="bg-primary rounded-2xl p-4 text-white shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[20px] icon-fill">{icon}</span>
          </div>
          {badge && (
            <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">{badge}</span>
          )}
        </div>
        <p className="text-xs text-white/70 font-medium uppercase tracking-wide">{label}</p>
        <h3 className="text-2xl font-extrabold mt-0.5">{value}</h3>
        <p className="text-xs text-white/60 mt-1">{sub}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm transition-transform active:scale-[0.98]">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
        <span className={`material-symbols-outlined ${iconColor} text-[18px] icon-fill`}>{icon}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wide">{label}</p>
      <h3 className="text-2xl font-extrabold mt-0.5">{value}</h3>
      <span className={`text-[11px] font-bold ${subColor}`}>{sub}</span>
    </div>
  )
}