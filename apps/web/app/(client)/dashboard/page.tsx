import { auth } from '@/lib/auth'
import type { AtletiSession } from '@atleti/types'
import { GlassCard, Badge } from '@atleti/ui'

export default async function ClientDashboard() {
  const session = await auth()
  const user = session!.user as unknown as AtletiSession
  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Вітаємо, {user.name}</h1>
      <GlassCard>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-500">Статус</p>
          <Badge variant="warning">Очікування тренера</Badge>
        </div>
        <p className="text-sm text-gray-400">
          Тренер надішле вам запрошення по нікнейму: <strong>@{user.nickname}</strong>
        </p>
      </GlassCard>
    </div>
  )
}
