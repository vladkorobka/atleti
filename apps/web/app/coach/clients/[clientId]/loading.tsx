import { Skeleton } from '@atleti/ui'

export default function Loading() {
  return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-20" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  )
}
