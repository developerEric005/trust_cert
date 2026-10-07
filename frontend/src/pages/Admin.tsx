import { useEffect, useState } from 'react'
import { approveUniversity, getUniversities } from '../api'
import { getSession } from '../auth'
import DashboardLayout from '../components/DashboardLayout'
import { navigate } from '../router'
import type { University } from '../types'

export default function Admin() {
  const session = getSession()
  const allowed = session?.role === 'admin'
  const [unis, setUnis] = useState<University[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allowed) { navigate('/login'); return }
    getUniversities().then(setUnis).catch((e) => setError(e.message))
  }, [])

  if (!session || !allowed) return null

  const approve = async (id: number) => {
    setBusy(id); setError('')
    try {
      await approveUniversity(id, session.token)
      setUnis((list) => list?.map((u) => (u.id === id ? { ...u, accredited: true } : u)) ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardLayout title="University approvals" orgName="Platform admin" nav={[['Approvals', '#approvals'], ['Public verify page', '/']]}>
      <section id="approvals" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Universities</h2>
          <p className="text-sm text-slate-600">Approve a university so its registrars can anchor batches.</p>
        </div>
        {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
        {!unis && !error && <p className="text-slate-600">Loading...</p>}
        {unis && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="bg-navy-50 text-sm text-slate-600">
                  <th className="rounded-l-lg px-4 py-3 font-semibold">University</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="rounded-r-lg px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {unis.map((u) => (
                  <tr key={u.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-4 font-semibold text-navy-900">{u.name}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.accredited ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {u.accredited ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {!u.accredited && (
                        <button disabled={busy === u.id} onClick={() => approve(u.id)}
                          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          {busy === u.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}
