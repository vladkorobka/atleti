'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard, Spinner } from '@atleti/ui'

function VerifyInner() {
  const token = useSearchParams().get('token') ?? ''
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!token) { setState('error'); return }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(res => setState(res.ok ? 'ok' : 'error'))
      .catch(() => setState('error'))
  }, [token])

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Spinner size={28} />
        <p className="text-sm text-gray-500">Підтверджуємо email...</p>
      </div>
    )
  }

  if (state === 'ok') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">Email підтверджено, акаунт створено. Тепер можна увійти.</p>
        <a href="/login" className="block text-center bg-gray-900 text-white rounded-md py-2.5 text-sm font-medium shadow-sm hover:bg-gray-700 transition-colors">
          Увійти
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-red-500">Посилання недійсне або застаріле. Зареєструйтеся ще раз, щоб отримати новий лист.</p>
      <a href="/register" className="block text-center text-sm underline text-gray-700">До реєстрації</a>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <GlassCard className="w-full max-w-sm">
      <h1 className="text-xl font-semibold mb-6 text-center">Підтвердження email</h1>
      <Suspense fallback={<div className="flex justify-center py-3"><Spinner size={22} /></div>}>
        <VerifyInner />
      </Suspense>
    </GlassCard>
  )
}
