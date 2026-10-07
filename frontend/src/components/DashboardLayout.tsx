import type { ReactNode } from 'react'
import { setSession } from '../auth'
import { Link, navigate } from '../router'
import { Shield, Wordmark } from './Brand'

interface Props {
  title: string
  orgName: string
  nav: [string, string][]
  children: ReactNode
}

function NavItem({ label, href, active, mobile }: { label: string; href: string; active: boolean; mobile?: boolean }) {
  const cls = mobile
    ? `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? 'bg-navy-900 text-white' : 'text-navy-900'}`
    : `rounded-lg px-3 py-2.5 text-[15px] ${active ? 'bg-navy-700 font-semibold text-white' : 'text-navy-100'}`
  return href.startsWith('#') ? <a href={href} className={cls}>{label}</a> : <Link to={href} className={cls}>{label}</Link>
}

export default function DashboardLayout({ title, orgName, nav, children }: Props) {
  const logout = () => { setSession(null); navigate('/login') }
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col gap-1 bg-navy-900 p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6 pt-2">
          <Shield size={30} />
          <Wordmark className="text-2xl font-bold text-white" />
        </div>
        {nav.map(([label, href], i) => <NavItem key={label} label={label} href={href} active={i === 0} />)}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-4 md:px-8">
          <h1 className="flex-1 text-xl font-bold text-navy-900 md:text-2xl">{title}</h1>
          <span className="text-sm text-slate-600">{orgName}</span>
          <button onClick={logout} className="rounded-lg border-2 border-navy-700 px-3 py-1.5 text-sm font-semibold text-navy-700">Log out</button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          {nav.map(([label, href], i) => <NavItem key={label} label={label} href={href} active={i === 0} mobile />)}
        </nav>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
