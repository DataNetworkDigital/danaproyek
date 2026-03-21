import { createContext, useContext } from 'react'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  // No auth for now — always authenticated
  const logout = () => {}

  return (
    <AuthContext.Provider value={{ authenticated: true, loading: false, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
