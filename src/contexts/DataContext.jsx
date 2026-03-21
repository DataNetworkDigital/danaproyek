import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import * as fs from '../lib/firestore'

const DataContext = createContext()

export function useData() {
  return useContext(DataContext)
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [investors, setInvestors] = useState([])
  const [allocations, setAllocations] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [p, i, a, pay] = await Promise.all([
        fs.getProjects(user.uid),
        fs.getInvestors(user.uid),
        fs.getAllocations(user.uid),
        fs.getPayments(user.uid),
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
  }, [user])

  useEffect(() => {
    if (user) refresh()
    else {
      setProjects([])
      setInvestors([])
      setAllocations([])
      setPayments([])
      setLoading(false)
    }
  }, [user, refresh])

  // Project actions
  const addProject = async (data) => {
    await fs.addProject(user.uid, data)
    await refresh()
  }
  const updateProject = async (id, data) => {
    await fs.updateProject(id, data)
    await refresh()
  }
  const deleteProject = async (id) => {
    await fs.deleteProject(id)
    await refresh()
  }

  // Investor actions
  const addInvestor = async (data) => {
    await fs.addInvestor(user.uid, data)
    await refresh()
  }
  const updateInvestor = async (id, data) => {
    await fs.updateInvestor(id, data)
    await refresh()
  }
  const deleteInvestor = async (id) => {
    await fs.deleteInvestor(id)
    await refresh()
  }

  // Allocation actions
  const addAllocation = async (data) => {
    await fs.addAllocation(user.uid, data)
    await refresh()
  }
  const updateAllocation = async (id, data) => {
    await fs.updateAllocation(id, data)
    await refresh()
  }
  const deleteAllocation = async (id) => {
    await fs.deleteAllocation(id)
    await refresh()
  }

  // Payment actions
  const addPayment = async (data) => {
    await fs.addPayment(user.uid, data)
    await refresh()
  }
  const updatePayment = async (id, data) => {
    await fs.updatePayment(id, data)
    await refresh()
  }
  const deletePayment = async (id) => {
    await fs.deletePayment(id)
    await refresh()
  }

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
