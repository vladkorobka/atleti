'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard, Button } from '@atleti/ui'

interface Props {
  clientId: string
  initialAnamnesis: string
}

export default function AnamnesisCard({ clientId, initialAnamnesis }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialAnamnesis)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const dirty = value !== initialAnamnesis

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anamnesis: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Помилка збереження')
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Помилка збереження')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-2">Анамнез</h2>
      <GlassCard className="space-y-2">
        <textarea
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false) }}
          rows={6}
          maxLength={5000}
          placeholder="Історія, травми, цілі, обмеження, нотатки про клієнта…"
          className="w-full resize-y rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm text-gray-900 shadow-sm backdrop-blur-sm placeholder:text-gray-400 transition-colors focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400/60"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{value.length} / 5000</span>
          {error && <span className="text-xs text-red-500">{error}</span>}
          {saved && !dirty && <span className="text-xs text-green-600">Збережено</span>}
          <Button onClick={handleSave} loading={saving} disabled={saving || !dirty} size="lg">
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
