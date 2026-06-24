'use client'
import React from 'react'
import { GlassModal } from './GlassModal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Червоне оформлення для деструктивних дій. */
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

// Діалог підтвердження дії (особливо деструктивної) на базі GlassModal.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <GlassModal open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 border border-gray-300 text-gray-700 rounded-md py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            danger ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-900 hover:bg-gray-700'
          }`}
        >
          {loading ? 'Зачекайте...' : confirmLabel}
        </button>
      </div>
    </GlassModal>
  )
}
