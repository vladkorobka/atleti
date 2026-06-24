'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@atleti/ui'
import { toast } from 'sonner'

export function LeaveCoachButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLeave() {
    setLoading(true)
    try {
      const res = await fetch('/api/client/coach', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Помилка. Спробуйте ще раз.')
        setLoading(false)
        return
      }
      toast.success('Ви відключилися від тренера. Заплановані заняття скасовано.')
      router.push('/client/dashboard')
      router.refresh()
    } catch {
      toast.error('Помилка. Спробуйте ще раз.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-red-500 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-red-600 transition-colors"
      >
        Відключитись від тренера
      </button>
      <ConfirmDialog
        open={open}
        title="Відключитися від тренера?"
        message="Ви впевнені, що хочете залишити тренера? Усі заплановані заняття буде видалено з розкладу, а баланс обнулиться."
        confirmLabel="Відключитися"
        danger
        loading={loading}
        onConfirm={handleLeave}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
