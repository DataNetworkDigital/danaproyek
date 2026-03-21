import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import * as fs from '../lib/firestore'

const DataContext = createContext()
const USER_ID = 'roxannecapital'

export function useData() {
  return useContext(DataContext)
}

export function DataProvider({ children }) {
  const { authenticated } = useAuth()
  const [projects, setProjects] = useState([])
  const [investors, setInvestors] = useState([])
  const [allocations, setAllocations] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!authenticated) return
    setLoading(true)
    try {
      const [p, i, a, pay] = await Promise.all([
        fs.getProjects(USER_ID),
        fs.getInvestors(USER_ID),
        fs.getAllocations(USER_ID),
        fs.getPayments(USER_ID),
      ])
      setProjects(p)
      setInvestors(i)
      setAllocations(a)
      setPayments(pay)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [authenticated])

  useEffect(() => {
    if (authenticated) refresh()
    else {
      setProjects([])
      setInvestors([])
      setAllocations([])
      setPayments([])
      setLoading(false)
    }
  }, [authenticated, refresh])

  const addProject = async (data) => { await fs.addProject(USER_ID, data); await refresh() }
  const updateProject = async (id, data) => { await fs.updateProject(id, data); await refresh() }
  const deleteProject = async (id) => { await fs.deleteProject(id); await refresh() }

  const addInvestor = async (data) => { await fs.addInvestor(USER_ID, data); await refresh() }
  const updateInvestor = async (id, data) => { await fs.updateInvestor(id, data); await refresh() }
  const deleteInvestor = async (id) => { await fs.deleteInvestor(id); await refresh() }

  const addAllocation = async (data) => { await fs.addAllocation(USER_ID, data); await refresh() }
  const updateAllocation = async (id, data) => { await fs.updateAllocation(id, data); await refresh() }
  const deleteAllocation = async (id) => { await fs.deleteAllocation(id); await refresh() }

  const addPayment = async (data) => { await fs.addPayment(USER_ID, data); await refresh() }
  const updatePayment = async (id, data) => { await fs.updatePayment(id, data); await refresh() }
  const deletePayment = async (id) => { await fs.deletePayment(id); await refresh() }

  return (
    <DataContext.Provider
      value={{
        projects, investors, allocations, payments, loading, refresh,
        addProject, updateProject, deleteProject,
        addInvestor, updateInvestor, deleteInvestor,
        addAllocation, updateAllocation, deleteAllocation,
        addPayment, updatePayment, deletePayment,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}
