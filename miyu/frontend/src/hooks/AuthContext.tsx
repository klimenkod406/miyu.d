
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getStoredTokens, storeTokens, clearTokens } from '../api/auth'

const API_BASE = '/api';

async function fetchWithTimeout<T>(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || 'Request failed');
    }
    return text ? JSON.parse(text) : (null as any);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
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
      const userData = await fetchWithTimeout<AuthUser>('/auth/me', {
        headers: { Authorization: 'Bearer ' + tokens.accessToken }
      })
      setUser(userData)
      setAccessToken(tokens.accessToken);
    } catch (err) {
      if (err instanceof Error && err.message.includes('timed out')) {
        handleClearTokens()
        return
      }
      try {
        const newTokens = await fetchWithTimeout<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        })
        handleSetTokens(newTokens.accessToken, newTokens.refreshToken)
        const userData = await fetchWithTimeout<AuthUser>('/auth/me', {
          headers: { Authorization: 'Bearer ' + newTokens.accessToken }
        })
        setUser(userData)
      } catch (refreshErr) {
        if (refreshErr instanceof Error && refreshErr.message.includes('timed out')) {
          handleClearTokens()
          return
        }
        handleClearTokens();
      }
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      const tokens = getStoredTokens()
      if (tokens) {
        try {
          const userData = await fetchWithTimeout<AuthUser>('/auth/me', {
            headers: { Authorization: 'Bearer ' + tokens.accessToken }
          })
          setUser(userData);
          setAccessToken(tokens.accessToken);
        } catch (err) {
          if (err instanceof Error && err.message.includes('timed out')) {
            setIsLoading(false)
            handleClearTokens()
            return
          }
          try {
            const newTokens = await fetchWithTimeout<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
              method: 'POST',
              body: JSON.stringify({ refreshToken: tokens.refreshToken }),
            })
            handleSetTokens(newTokens.accessToken, newTokens.refreshToken)
            const userData = await fetchWithTimeout<AuthUser>('/auth/me', {
              headers: { Authorization: 'Bearer ' + newTokens.accessToken }
            })
            setUser(userData)
          } catch (refreshErr) {
            if (refreshErr instanceof Error && refreshErr.message.includes('timed out')) {
              setIsLoading(false)
              handleClearTokens()
              return
            }
            handleClearTokens();
          }
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetchWithTimeout<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    handleSetTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }

  const register = async (email: string, username: string, password: string) => {
    const response = await fetchWithTimeout<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })
    handleSetTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }

  const logout = async () => {
    const tokens = getStoredTokens()
    if (tokens) {
      try {
        await fetchWithTimeout('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        })
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
