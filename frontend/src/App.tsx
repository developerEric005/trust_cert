import { lazy, Suspense } from 'react'
import PublicShell from './components/PublicShell'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Registrar from './pages/Registrar'
import Verify from './pages/Verify'
import { usePath } from './router'

const Scan = lazy(() => import('./pages/Scan'))

export default function App() {
  const path = usePath()
  if (path === '/registrar') return <Registrar />
  if (path === '/admin') return <Admin />

  const m = path.match(/^\/verify\/(\d+)\/([^/]+)$/)
  return (
    <PublicShell>
      {path === '/login' ? <Login />
        : path === '/scan' ? <Suspense fallback={<p className="text-slate-600">Loading camera...</p>}><Scan /></Suspense>
        : <Verify key={path} initial={m ? { uniId: Number(m[1]), serial: decodeURIComponent(m[2]) } : undefined} />}
    </PublicShell>
  )
}
