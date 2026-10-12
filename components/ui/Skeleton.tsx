'use client'

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse bg-surface-container-high rounded-lg skeleton-shimmer', className)} />
}

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3 w-full', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-2xl p-4 space-y-3 bg-surface-container-lowest border border-outline-variant">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-2 w-16" />
      </div>
      <SkeletonCard />
      <SkeletonCard className="hidden sm:block" />
    </div>
  )
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Skeleton className="w-5 h-5 rounded-lg" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-16 ml-auto rounded-full" />
      </div>
      <div className="divide-y divide-outline-variant/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-[190px] w-full rounded-xl" />
    </div>
  )
}

export function AppShellSkeleton() {
  return (
    <div className="space-y-4 w-full page-fade">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg hidden sm:block" />
      </div>
      <SkeletonStats />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SkeletonList rows={3} />
        <SkeletonChart />
      </div>
      <SkeletonList rows={3} />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-20 ml-auto rounded-lg" />
      </div>
      <div className="divide-y divide-outline-variant/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-3 w-24 hidden sm:block" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28 hidden md:block" />
            <Skeleton className="h-5 w-16 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}
