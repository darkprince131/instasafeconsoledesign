/**
 * The demo's database.
 *
 * IndexedDB, wrapped in a tiny promise API that looks like a table store. It
 * persists across refreshes, is per-visitor, and never leaves the browser —
 * which is exactly what a self-serve demo wants: nobody can break anybody
 * else's sandbox, and there is no backend to attack.
 *
 * Developers replace this wholesale. Nothing outside src/api/ imports it.
 */

const DB_NAME = 'i365-console'
/* Bumped when STORES gains a collection. An existing visitor's database was
   created at the old version, so without a bump `onupgradeneeded` never runs
   and the new store simply is not there — which surfaces as
   NotFoundError on the first list() against it. */
const DB_VERSION = 3

/** Every collection the console needs. Mirrors the eventual table list. */
export const STORES = [
  'users', 'groups', 'lockouts', 'devices', 'authDevices', 'deviceChecks', 'devicePolicies',
  'geoFences', 'blockedApps', 'deviceUpdates', 'softwarePackages',
  'applications', 'appServices', 'appGroups', 'accessRules',
  'controllers', 'gateways',
  'authProfiles', 'userProviders', 'idamServices',
  'subAdmins', 'roles', 'timeSchedules', 'riskProfiles',
  'urlFilters', 'contentFilters', 'fileTypeFilters', 'domainLists',
  'sessions', 'eventLog', 'accessLog', 'anomalies', 'inbox',
  'settings', 'reportSubscriptions', 'exportProfiles'
]

let _db = null

function open () {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    /* A version bump cannot proceed while another tab still holds the old
       version open. Without this handler that request simply never settles:
       no error, no rejection, every call after it awaiting a promise that
       will not resolve, and a console that hangs with a loading skeleton
       for ever. Anyone with the demo open in two tabs across a deploy hits
       it. Saying what happened lets the caller show it. */
    req.onblocked = () => reject(new Error(
      'Another tab has this demo open on an older version. Close the other tabs and reload.'))
    req.onsuccess = () => {
      _db = req.result
      /* And the reverse: when some other tab wants to upgrade, step out of
         its way rather than being the tab that blocks it. */
      _db.onversionchange = () => { _db.close(); _db = null }
      resolve(_db)
    }
    req.onerror = () => reject(req.error)
  })
}

function tx (store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let out
    try { out = fn(s) } catch (err) { reject(err); return }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  }))
}

export const db = {
  /** Every row in a collection. */
  all (store) {
    return tx(store, 'readonly', s => s.getAll())
  },

  get (store, id) {
    return tx(store, 'readonly', s => s.get(id))
  },

  put (store, record) {
    return tx(store, 'readwrite', s => { s.put(record); return record })
  },

  /** Writes many rows in one transaction — used by the seeder. */
  putMany (store, records) {
    return tx(store, 'readwrite', s => { records.forEach(r => s.put(r)); return records })
  },

  remove (store, id) {
    return tx(store, 'readwrite', s => { s.delete(id); return id })
  },

  removeMany (store, ids) {
    return tx(store, 'readwrite', s => { ids.forEach(id => s.delete(id)); return ids })
  },

  clear (store) {
    return tx(store, 'readwrite', s => { s.clear(); return true })
  },

  async clearAll () {
    for (const name of STORES) await db.clear(name)
  },

  /** Drops the whole database. The Reset Demo button. */
  destroy () {
    _db?.close()
    _db = null
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve(true)
    })
  }
}

/** Short, sortable, readable ids — easier to eyeball in a demo than a UUID. */
let _seq = 0
export function id (prefix = 'id') {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}${_seq.toString(36).padStart(2, '0')}`
}
