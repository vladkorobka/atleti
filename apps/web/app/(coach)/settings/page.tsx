'use client'
import { useState, useEffect, useCallback } from 'react'
import { GlassCard, GlassModal } from '@atleti/ui'

interface Package {
  _id: string
  name: string
  sessions: number
  price: number
  currency: string
}

export default function SettingsPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', sessions: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadPackages = useCallback(async () => {
    const res = await fetch('/api/coach/packages')
    const data = await res.json()
    setPackages(data.packages ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPackages() }, [loadPackages])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/coach/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, sessions: Number(form.sessions), price: Number(form.price), currency: 'UAH' }),
    })
    const data = await res.json()
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Помилка'); setSaving(false); return }
    setPackages(data.packages)
    setAddOpen(false)
    setForm({ name: '', sessions: '', price: '' })
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/coach/packages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      setPackages(data.packages)
    }
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Пакети занять</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Додати пакет
        </button>
      </div>

      {packages.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-gray-400 text-center py-6">
            Пакети ще не додані. Натисніть &ldquo;Додати пакет&rdquo;.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {packages.map(pkg => (
            <GlassCard key={pkg._id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{pkg.name}</p>
                <p className="text-sm text-gray-500">{pkg.sessions} занять · {pkg.price} {pkg.currency}</p>
              </div>
              <button
                onClick={() => handleDelete(pkg._id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Видалити
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassModal open={addOpen} onClose={() => setAddOpen(false)} title="Новий пакет">
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Назва (напр. «8 тренувань»)" required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="number" min="1" required
            value={form.sessions} onChange={e => setForm(f => ({ ...f, sessions: e.target.value }))}
            placeholder="Кількість занять"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <div className="flex gap-2 items-center">
            <input
              type="number" min="0" required
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="Ціна"
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <span className="text-sm text-gray-500 whitespace-nowrap">грн</span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {saving ? 'Збереження...' : 'Додати'}
          </button>
        </form>
      </GlassModal>
    </div>
  )
}
