'use client'
import { useState } from 'react'
import { GlassModal } from '@atleti/ui'

interface Props { canInvite: boolean }

export default function InviteButton({ canInvite }: Props) {
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/coach/clients/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nickname.trim().toLowerCase() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Помилка')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => { setOpen(false); setSuccess(false); setNickname(''); window.location.reload() }, 1500)
  }

  return (
    <>
      <button
        disabled={!canInvite}
        onClick={() => setOpen(true)}
        className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {canInvite ? 'Запросити клієнта' : 'Досягнуто ліміт клієнтів'}
      </button>

      <GlassModal open={open} onClose={() => setOpen(false)} title="Запросити клієнта">
        {success ? (
          <p className="text-center text-green-600 py-4">Запрошення надіслано!</p>
        ) : (
          <form onSubmit={handleInvite} className="space-y-3">
            <p className="text-sm text-gray-500">Введіть нікнейм клієнта (без @)</p>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="nickname"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Надсилання...' : 'Надіслати запрошення'}
            </button>
          </form>
        )}
      </GlassModal>
    </>
  )
}
