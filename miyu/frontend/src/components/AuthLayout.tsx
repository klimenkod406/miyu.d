import { ReactNode } from 'react'
import StarField from './StarField'
import PageContent from './PageContent'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <StarField />
      <div className="relative z-10">
        <PageContent>{children}</PageContent>
      </div>
    </div>
  )
}