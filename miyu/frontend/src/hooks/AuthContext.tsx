
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, getStoredTokens, storeTokens, clearTokens } from '../api/auth'

interface AuthUser {
  id: number
  email: string
  username: string
  role: string
  avatar_url: string | null
  bio: string | null
  is_verified: boolean
  is_premium: boolean
  premium_expires_at: string | null
  palette_mode?: string
  palette_primary?: string
  palette_secondary?: string
  palette_tertiary?: string
  palette_accent?: string
}

interface AuthContextType {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(getStoredTokens()?.accessToken || null);
  const [isLoading, setIsLoading] = useState(true)

  const handleSetTokens = (access: string, refresh: string) => {
    storeTokens(access, refresh);
    setAccessToken(access);
    window.dispatchEvent(new Event('miyu-auth-changed'));
  };

  const handleClearTokens = () => {
    clearTokens();
    setAccessToken(null);
    setUser(null);
    window.dispatchEvent(new Event('miyu-auth-changed'));
  };

  const refreshUser = async () => {
    const tokens = getStoredTokens()
    if (!tokens) {
      setUser(null)
      return
    }

    try {
      const userData = await authApi.me(tokens.accessToken)
      setUser(userData)
      setAccessToken(tokens.accessToken);
    } catch (err) {
      try {
        const newTokens = await authApi.refresh(tokens.refreshToken)
        handleSetTokens(newTokens.accessToken, newTokens.refreshToken)
        const userData = await authApi.me(newTokens.accessToken)
        setUser(userData)
      } catch (refreshErr) {
        handleClearTokens();
      }
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      const tokens = getStoredTokens()
      if (tokens) {
        try {
          const userData = await authApi.me(tokens.accessToken)
          setUser(userData);
          setAccessToken(tokens.accessToken);
        } catch (err) {
          try {
            const newTokens = await authApi.refresh(tokens.refreshToken)
            handleSetTokens(newTokens.accessToken, newTokens.refreshToken)
            const userData = await authApi.me(newTokens.accessToken)
            setUser(userData)
          } catch (refreshErr) {
            handleClearTokens();
          }
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    handleSetTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }

  const register = async (email: string, username: string, password: string) => {
    const response = await authApi.register({ email, username, password })
    handleSetTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }

  const logout = async () => {
    const tokens = getStoredTokens()
    if (tokens) {
      try {
        await authApi.logout(tokens.refreshToken)
      } catch {}
    }
    handleClearTokens();
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, isAuthenticated, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
