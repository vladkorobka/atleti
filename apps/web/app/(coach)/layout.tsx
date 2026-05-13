import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { AtletiSession } from '@atleti/types'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white/70 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Атлеті</span>
        <span className="text-sm text-gray-500">{user.name}</span>
      </nav>
      <main className="max-w-4xl mx-auto p-4">{children}</main>
    </div>
  )
}
