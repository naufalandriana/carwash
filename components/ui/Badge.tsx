import { TransactionStatus } from '@/lib/Data'

interface BadgeProps {
  status: TransactionStatus
}

export default function Badge({ status }: BadgeProps) {
  if (status === 'Selesai') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-container text-success">
        <span className="material-symbols-outlined text-[11px] icon-fill">check_circle</span>
        {status}
      </span>
    )
  }
  if (status === 'Proses') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-container text-primary">
        <span className="material-symbols-outlined text-[11px]">autorenew</span>
        {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-container text-primary">
      <span className="material-symbols-outlined text-[11px]">schedule</span>
      {status}
    </span>
  )
}