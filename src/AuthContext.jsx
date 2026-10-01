import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

const AuthContext = createContext(null)
const TOKEN_KEY = 'bizora-token'

function AuthProviderState({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    const syncToken = () => {
      const next = localStorage.getItem(TOKEN_KEY)
      setToken(current => current === next ? current : next)
    }
    window.addEventListener('storage', syncToken)
    window.addEventListener('bizora-auth-changed', syncToken)
    return () => {
      window.removeEventListener('storage', syncToken)
      window.removeEventListener('bizora-auth-changed', syncToken)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!token) {
        setUser(null)
        setMerchant(null)
        setVerification(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await api('/api/me', {}, token)
        if (!ignore) {
          setUser(data.user)
          setMerchant(data.merchant || null)
          setVerification(data.verification || null)
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        if (!ignore) {
          setToken(null)
          setUser(null)
          setMerchant(null)
          setVerification(null)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [token])

  const finishAuth = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    setMerchant(null)
    setVerification(null)
    window.dispatchEvent(new Event('bizora-auth-changed'))
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setMerchant(null)
    setVerification(null)
    window.dispatchEvent(new Event('bizora-auth-changed'))
  }

  const refresh = async () => {
    if (!token) return
    const data = await api('/api/me', {}, token)
    setUser(data.user)
    setMerchant(data.merchant || null)
    setVerification(data.verification || null)
    return data
  }

  const value = useMemo(
    () => ({ token, user, merchant, verification, loading, finishAuth, logout, refresh }),
    [token, user, merchant, verification, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }) {
  const existing = useContext(AuthContext)
  if (existing) return children
  return <AuthProviderState>{children}</AuthProviderState>
}

export const useAuth = () => useContext(AuthContext)
