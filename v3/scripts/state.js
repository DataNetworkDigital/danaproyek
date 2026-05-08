// ============================================================
// State — single source of truth + Firestore sync
// Shares DOC_ID with v2 so both versions read the same data.
// ============================================================

const DOC_ID = 'main_data';
const LS_KEY = 'dt_v3'; // shared with v2 for instant cross-version data

export const S = {
  projects: [],
  fund: {
    kurAmount: 500,
    angsuran: 9.6665,
    bufferMonths: 6,
    living: 25,
    startDate: new Date().toISOString().split('T')[0],
  },
  external: [],
  docCounter: 0,
  generatedDocs: [],
};

let _saveTimer = null;
let _saving = false;
let _adminUnlocked = false;
const _listeners = new Set();

/* ---------- Lifecycle ---------- */

export function setAdminUnlocked(v) {
  _adminUnlocked = !!v;
  emit('admin');
}

export function isAdmin() {
  return _adminUnlocked;
}

export function loadLocal() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) Object.assign(S, JSON.parse(s));
  } catch (e) {
    console.warn('localStorage load failed', e);
  }
}

export async function loadFromFirestore() {
  setSync('syncing');
  try {
    const snap = await window.__db.collection('danatrack').doc(DOC_ID).get();
    if (snap.exists) {
      const d = snap.data();
      Object.assign(S, d.state);
      try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {}
      setSync('synced', d.updatedAt);
    } else {
      setSync('synced');
    }
    emit('data');
  } catch (e) {
    console.warn('Firestore load failed', e);
    setSync('error');
  }
}

export function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(S));
  } catch (_) {}
  emit('data');
  if (!_adminUnlocked) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveToFirestore, 800);
}

async function saveToFirestore() {
  if (!_adminUnlocked || _saving) return;
  _saving = true;
  setSync('syncing');
  try {
    const ts = new Date().toISOString();
    await window.__db
      .collection('danatrack')
      .doc(DOC_ID)
      .set(
        { state: JSON.parse(JSON.stringify(S)), updatedAt: ts },
        { merge: true }
      );
    setSync('synced', ts);
  } catch (e) {
    console.warn('Firestore save failed', e);
    setSync('error');
  }
  _saving = false;
}

/* ---------- Subscriptions ---------- */

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit(kind) {
  _listeners.forEach((fn) => {
    try { fn(kind); } catch (e) { console.error(e); }
  });
}

/* ---------- Sync indicator ---------- */

function setSync(state, ts) {
  // Sync indicator is rendered into header; updated via a global hook
  if (typeof window !== 'undefined' && window.__updateSync) {
    window.__updateSync(state, ts);
  }
}
