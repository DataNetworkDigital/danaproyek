import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// === PROJECTS ===
export async function getProjects(userId) {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addProject(userId, data) {
  return addDoc(collection(db, 'projects'), {
    ...data,
    userId,
    status: data.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateProject(id, data) {
  return updateDoc(doc(db, 'projects', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProject(id) {
  return deleteDoc(doc(db, 'projects', id))
}

// === INVESTORS ===
export async function getInvestors(userId) {
  const q = query(
    collection(db, 'investors'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addInvestor(userId, data) {
  return addDoc(collection(db, 'investors'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateInvestor(id, data) {
  return updateDoc(doc(db, 'investors', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteInvestor(id) {
  return deleteDoc(doc(db, 'investors', id))
}

// === ALLOCATIONS (investor -> project funding) ===
export async function getAllocations(userId) {
  const q = query(
    collection(db, 'allocations'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addAllocation(userId, data) {
  return addDoc(collection(db, 'allocations'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateAllocation(id, data) {
  return updateDoc(doc(db, 'allocations', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteAllocation(id) {
  return deleteDoc(doc(db, 'allocations', id))
}

// === PAYMENTS ===
export async function getPayments(userId) {
  const q = query(
    collection(db, 'payments'),
    where('userId', '==', userId),
    orderBy('dueDate', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function addPayment(userId, data) {
  return addDoc(collection(db, 'payments'), {
    ...data,
    userId,
    status: data.status || 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updatePayment(id, data) {
  return updateDoc(doc(db, 'payments', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deletePayment(id) {
  return deleteDoc(doc(db, 'payments', id))
}
