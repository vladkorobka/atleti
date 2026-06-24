'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@atleti/ui'
import { toast } from 'sonner'

export default function RemoveClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    setLoading(true)
    try {
      const res = await fetch(`/api/coach/clients/${clientId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Не вдалося відмовитися від клієнта. Спробуйте ще раз.')
        setLoading(false)
        return
      }
      toast.success('Ви відмовилися від клієнта. Розклад занять очищено.')
      router.push('/coach/clients')
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
        className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm font-medium hover:bg-red-50 transition-colors"
      >
        Відмовитися від клієнта
      </button>
      <ConfirmDialog
        open={open}
        title="Відмовитися від клієнта?"
        message={
          <>
            Ви дійсно хочете відмовитися від клієнта <span className="font-medium">{clientName}</span>?
            Усі заплановані заняття буде видалено з розкладу — у вас і в клієнта. Цю дію не можна скасувати.
          </>
        }
        confirmLabel="Відмовитися"
        danger
        loading={loading}
        onConfirm={handleRemove}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
