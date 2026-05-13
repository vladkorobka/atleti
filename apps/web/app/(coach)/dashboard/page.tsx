import { auth } from '@/lib/auth'
import type { AtletiSession } from '@atleti/types'
import { GlassCard } from '@atleti/ui'

export default async function CoachDashboard() {
  const session = await auth()
  const user = session!.user as unknown as AtletiSession
  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold">Вітаємо, {user.name}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard>
          <p className="text-sm text-gray-500">Клієнти</p>
          <p className="text-2xl font-bold">0 / 10</p>
        </GlassCard>
        <GlassCard>
          <p className="text-sm text-gray-500">Заняття цього місяця</p>
          <p className="text-2xl font-bold">0</p>
        </GlassCard>
      </div>
      <GlassCard>
        <p className="text-gray-400 text-sm text-center py-8">Функціонал додається в наступних планах</p>
      </GlassCard>
    </div>
  )
}
