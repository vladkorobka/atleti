import { Skeleton } from '@atleti/ui'

export default function Loading() {
  return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-24" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  )
}
