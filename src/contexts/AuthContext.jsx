import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()
const PIN_KEY = 'fundtracker_authenticated'
const APP_PIN = import.meta.env.VITE_PIN_CODE || '000000'

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = sessionStorage.getItem(PIN_KEY)
    if (saved === 'true') setAuthenticated(true)
    setLoading(false)
  }, [])

  const login = (pin) => {
    if (pin === APP_PIN) {
      sessionStorage.setItem(PIN_KEY, 'true')
      setAuthenticated(true)
      return true
    }
    return false
  }

  const logout = () => {
    sessionStorage.removeItem(PIN_KEY)
    setAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
