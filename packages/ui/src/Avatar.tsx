import React from 'react'

interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' }

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  return src ? (
    <img src={src} alt={name} className={`${sizeClasses[size]} rounded-full object-cover`} />
  ) : (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600`}>
      {initials}
    </div>
  )
}
