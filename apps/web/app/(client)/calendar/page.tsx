import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { AtletiSession } from '@atleti/types'
import ClientCalendar from './ClientCalendar'

export default async function ClientCalendarPage() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'client') redirect('/login')
  return (
    <div>
      <ClientCalendar />
    </div>
  )
}
