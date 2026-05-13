import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { AtletiSession } from '@atleti/types'
import { GlassCard } from '@atleti/ui'

export default async function ProfilePage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/login')

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-2xl font-semibold text-gray-900">Профіль</h1>

      <GlassCard>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">Ім&apos;я</p>
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="text-sm font-medium text-gray-900">{user.email}</p>
          </div>
          {user.nickname && (
            <div>
              <p className="text-xs text-gray-500">Нікнейм</p>
              <p className="text-sm font-medium text-gray-900">@{user.nickname}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Роль</p>
            <p className="text-sm font-medium text-gray-900">Клієнт</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
