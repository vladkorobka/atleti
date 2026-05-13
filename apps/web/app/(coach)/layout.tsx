import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { AtletiSession } from '@atleti/types'
import { CoachBottomNav, CoachTopNav } from './CoachNav'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/70 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <span className="font-semibold text-gray-900">Атлеті</span>
        <CoachTopNav />
        <span className="text-sm text-gray-500 lg:hidden">{user.name}</span>
      </header>
      <main className="max-w-4xl mx-auto p-4 pb-24 lg:pb-4">{children}</main>
      <CoachBottomNav />
    </div>
  )
}
