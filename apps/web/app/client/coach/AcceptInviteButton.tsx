'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, CheckIcon } from '@atleti/ui'

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
      <Button
        onClick={handleAccept}
        loading={loading}
        leftIcon={<CheckIcon />}
        size="lg"
      >
        {loading ? 'Прийняття...' : 'Прийняти запрошення'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </>
  )
}
