import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// Helper: fetch collection filtered by userId, sort client-side
async function fetchByUser(col, userId) {
  const q = query(collection(db, col), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// === PROJECTS ===
export async function getProjects(userId) {
  const items = await fetchByUser('projects', userId)
  return items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function addProject(userId, data) {
  return addDoc(collection(db, 'projects'), {
    ...data, userId, status: data.status || 'active',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateProject(id, data) {
  return updateDoc(doc(db, 'projects', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteProject(id) {
  return deleteDoc(doc(db, 'projects', id))
}

// === INVESTORS ===
export async function getInvestors(userId) {
  const items = await fetchByUser('investors', userId)
  return items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function addInvestor(userId, data) {
  return addDoc(collection(db, 'investors'), {
    ...data, userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateInvestor(id, data) {
  return updateDoc(doc(db, 'investors', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteInvestor(id) {
  return deleteDoc(doc(db, 'investors', id))
}

// === ALLOCATIONS ===
export async function getAllocations(userId) {
  const items = await fetchByUser('allocations', userId)
  return items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function addAllocation(userId, data) {
  return addDoc(collection(db, 'allocations'), {
    ...data, userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateAllocation(id, data) {
  return updateDoc(doc(db, 'allocations', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteAllocation(id) {
  return deleteDoc(doc(db, 'allocations', id))
}

// === PAYMENTS ===
export async function getPayments(userId) {
  const items = await fetchByUser('payments', userId)
  return items.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
}

export async function addPayment(userId, data) {
  return addDoc(collection(db, 'payments'), {
    ...data, userId, status: data.status || 'pending',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updatePayment(id, data) {
  return updateDoc(doc(db, 'payments', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deletePayment(id) {
  return deleteDoc(doc(db, 'payments', id))
}
