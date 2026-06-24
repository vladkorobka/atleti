'use client'
import { signOut } from 'next-auth/react'
import { LogOutIcon } from '@atleti/ui'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded-md hover:bg-gray-100"
    >
      <LogOutIcon className="h-4 w-4" />
      Вийти
    </button>
  )
}
