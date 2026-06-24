'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog, Button } from '@atleti/ui'
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
      <Button variant="danger" onClick={() => setOpen(true)} size="lg">
        Відключитись від тренера
      </Button>
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
