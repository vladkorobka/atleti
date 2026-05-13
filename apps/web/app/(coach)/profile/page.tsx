'use client'
import { useState, useEffect } from 'react'
import { GlassCard } from '@atleti/ui'

export default function ProfilePage() {
  const [bio, setBio] = useState('')
  const [specializations, setSpecializations] = useState('')
  const [deadlineHours, setDeadlineHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/coach/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setBio(data.profile.bio ?? '')
          setSpecializations((data.profile.specializations ?? []).join(', '))
          setDeadlineHours(data.profile.cancellationDeadlineHours ?? 24)
        }
        setLoading(false)
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/coach/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: bio.trim(),
        specializations: specializations.split(',').map(s => s.trim()).filter(Boolean),
        cancellationDeadlineHours: deadlineHours,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error?.bio?.[0] ?? 'Помилка збереження'); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="pt-4"><p className="text-sm text-gray-400">Завантаження...</p></div>

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-xl font-semibold text-gray-900">Профіль тренера</h1>

      <GlassCard>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Про себе</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Розкажіть про свій досвід та підхід до тренувань..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/1000</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Спеціалізації</label>
            <input
              value={specializations}
              onChange={e => setSpecializations(e.target.value)}
              placeholder="фітнес, реабілітація, схуднення (через кому)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Вводьте через кому</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дедлайн скасування заняття клієнтом
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={168}
                value={deadlineHours}
                onChange={e => setDeadlineHours(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <span className="text-sm text-gray-500">годин до заняття</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Клієнт не зможе скасувати заняття менш ніж за {deadlineHours} год
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Збереження...' : saved ? 'Збережено' : 'Зберегти'}
          </button>
        </form>
      </GlassCard>
    </div>
  )
}
