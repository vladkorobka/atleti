'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AcceptInviteButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleAccept() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/client/coach', { method: 'PATCH' })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError('Помилка при прийнятті запрошення')
    }
  }

  return (
    <>
      <button
        onClick={handleAccept}
        disabled={loading}
        className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Прийняття...' : 'Прийняти запрошення'}
      </button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </>
  )
}
