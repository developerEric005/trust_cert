import type { LoginResponse } from './types'

const KEY = 'trustcert.session'

export function getSession(): LoginResponse | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export function setSession(s: LoginResponse | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s))
  else localStorage.removeItem(KEY)
}
