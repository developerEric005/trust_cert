import { lazy, Suspense } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import PublicShell from './components/PublicShell'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Registrar from './pages/Registrar'
import Verify from './pages/Verify'
import { usePath } from './router'

const Scan = lazy(() => import('./pages/Scan'))
const QrMaker = lazy(() => import('./pages/QrMaker'))

const Loading = ({ text }: { text: string }) => <p className="text-slate-600">{text}</p>

export default function App() {
  const path = usePath()
  const m = path.match(/^\/verify\/(\d+)\/([^/]+)$/)

  let page
  if (path === '/registrar') page = <Registrar />
  else if (path === '/admin') page = <Admin />
  else if (path === '/qr') page = <PublicShell wide><Suspense fallback={<Loading text="Loading..." />}><QrMaker /></Suspense></PublicShell>
  else page = (
    <PublicShell>
      {path === '/login' ? <Login />
        : path === '/scan' ? <Suspense fallback={<Loading text="Loading camera..." />}><Scan /></Suspense>
        : <Verify initial={m ? { uniId: Number(m[1]), serial: decodeURIComponent(m[2]) } : undefined} />}
    </PublicShell>
  )

  return <ErrorBoundary key={path}>{page}</ErrorBoundary>
}
