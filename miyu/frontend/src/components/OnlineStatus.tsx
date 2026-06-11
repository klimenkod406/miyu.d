import React from 'react'

interface OnlineStatusProps {
  isOnline?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function OnlineStatus({ isOnline, size = 'sm', className = '' }: OnlineStatusProps) {
  if (!isOnline) return null

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div
      className={`rounded-full bg-green-500 ring-2 ring-black ${sizeClasses[size]} ${className}`}
      title="Онлайн"
    />
  )
}
