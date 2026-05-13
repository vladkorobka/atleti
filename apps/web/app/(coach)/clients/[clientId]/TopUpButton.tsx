'use client'
import { useState } from 'react'
import { GlassModal } from '@atleti/ui'

interface Props { clientId: string }

export default function TopUpButton({ clientId }: Props) {
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
    window.location.reload()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-gray-300 rounded-md py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Поповнити баланс
      </button>
      <GlassModal open={open} onClose={() => setOpen(false)} title="Поповнити баланс">
        <form onSubmit={handleTopUp} className="space-y-3">
          <input
            type="number" min="1" max="1000" required
            value={sessions} onChange={e => setSessions(e.target.value)}
            placeholder="Кількість занять"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Примітка (необов'язково)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {loading ? 'Збереження...' : 'Поповнити'}
          </button>
        </form>
      </GlassModal>
    </>
  )
}
