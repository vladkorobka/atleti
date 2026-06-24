'use client'
import { useState } from 'react'
import { GlassModal, Button, Input } from '@atleti/ui'

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
      <Button
        disabled={!canInvite}
        onClick={() => setOpen(true)}
        fullWidth
        size="lg"
      >
        {canInvite ? 'Запросити клієнта' : 'Досягнуто ліміт клієнтів'}
      </Button>

      <GlassModal open={open} onClose={() => setOpen(false)} title="Запросити клієнта">
        {success ? (
          <p className="text-center text-green-600 py-4">Запрошення надіслано!</p>
        ) : (
          <form onSubmit={handleInvite} className="space-y-3">
            <p className="text-sm text-gray-500">Введіть нікнейм клієнта (без @)</p>
            <Input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="nickname"
              required
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button type="submit" loading={loading} fullWidth size="lg">
              {loading ? 'Надсилання...' : 'Надіслати запрошення'}
            </Button>
          </form>
        )}
      </GlassModal>
    </>
  )
}
