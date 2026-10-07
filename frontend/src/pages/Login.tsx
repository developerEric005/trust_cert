import { useState, type FormEvent } from 'react'
import { login } from '../api'
import { setSession } from '../auth'
import { Link, navigate } from '../router'
import { inputClass, primaryButton } from '../ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const s = await login(email.trim(), password)
      setSession(s)
      navigate(s.role === 'admin' ? '/admin' : '/registrar')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">Sign in</h2>
        <p className="mt-1 text-sm text-slate-600">For university registrars and platform admins.</p>
      </div>
      <label className="block text-sm font-medium text-navy-900">Email
        <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="block text-sm font-medium text-navy-900">Password
        <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
      <button type="submit" className={primaryButton} disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      <Link to="/" className="block text-center text-sm font-semibold text-teal-700 underline">Back to certificate verification</Link>
    </form>
  )
}
