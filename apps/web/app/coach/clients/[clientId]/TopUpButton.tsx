'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassModal, Button, Input } from '@atleti/ui'

interface Props { clientId: string }

export default function TopUpButton({ clientId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/coach/clients/${clientId}/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: Number(sessions), note }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Помилка'); setLoading(false); return }
    setOpen(false)
    setSessions('')
    setNote('')
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} fullWidth size="lg">
        Поповнити баланс
      </Button>
      <GlassModal open={open} onClose={() => setOpen(false)} title="Поповнити баланс">
        <form onSubmit={handleTopUp} className="space-y-3">
          <Input
            type="number" min="1" max="1000" required
            value={sessions} onChange={e => setSessions(e.target.value)}
            placeholder="Кількість занять"
          />
          <Input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Примітка (необов'язково)"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" loading={loading} fullWidth size="lg">
            {loading ? 'Збереження...' : 'Поповнити'}
          </Button>
        </form>
      </GlassModal>
    </>
  )
}
