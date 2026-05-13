import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function Home() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as any).role
  const nickname = (session.user as any).nickname
  if (!nickname) redirect('/role-select')
  redirect(role === 'coach' ? '/coach/dashboard' : '/client/dashboard')
}
