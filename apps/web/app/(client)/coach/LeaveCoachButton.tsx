'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LeaveCoachButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLeave() {
    setLoading(true)
    await fetch('/api/client/coach', { method: 'DELETE' })
    router.push('/dashboard')
  }

  return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="bg-red-500 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
    >
      {loading ? 'Відключення...' : 'Відключитись від тренера'}
    </button>
  )
}
