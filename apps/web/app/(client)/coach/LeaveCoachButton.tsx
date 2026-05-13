'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LeaveCoachButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLeave() {
    if (!window.confirm('Ви впевнені, що хочете залишити тренера?')) return
    setLoading(true)
    try {
      await fetch('/api/client/coach', { method: 'DELETE' })
      router.push('/dashboard')
    } catch {
      alert('Помилка. Спробуйте ще раз.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLeave}
      disabled={loading}
      className="bg-red-500 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
    >
      {loading ? 'Зачекайте...' : 'Відключитись від тренера'}
    </button>
  )
}
