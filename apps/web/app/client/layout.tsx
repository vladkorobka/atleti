import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { AtletiSession } from '@atleti/types'
import { ClientBottomNav, ClientTopNav } from './ClientNav'
import { LogoutButton } from '@/components/LogoutButton'
import { Logo } from '@/components/Logo'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/')
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white/70 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <Logo className="h-7" />
        <ClientTopNav />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 lg:hidden">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 pb-24 lg:pb-4">{children}</main>
      <ClientBottomNav />
    </div>
  )
}
