import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('bizora-token'))
  const [user, setUser] = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    let ignore = false
    async function load() {
      if (!token) { setUser(null); setMerchant(null); setLoading(false); return }
      setLoading(true)
      try {
        const data = await api('/api/me', {}, token)
        if (!ignore) { setUser(data.user); setMerchant(data.merchant || null) }
      } catch {
        localStorage.removeItem('bizora-token')
        if (!ignore) { setToken(null); setUser(null); setMerchant(null) }
      } finally { if (!ignore) setLoading(false) }
    }
    load()
    return () => { ignore = true }
  }, [token])

  const finishAuth = (data) => {
    localStorage.setItem('bizora-token', data.token)
    setToken(data.token)
    setUser(data.user)
  }
  const logout = () => { localStorage.removeItem('bizora-token'); setToken(null); setUser(null); setMerchant(null) }
  const refresh = async () => {
    if (!token) return
    const data = await api('/api/me', {}, token)
    setUser(data.user); setMerchant(data.merchant || null)
  }

  const value = useMemo(() => ({ token, user, merchant, loading, finishAuth, logout, refresh }), [token, user, merchant, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
