import AnimatedBackground from './components/AnimatedBackground'
import Verify from './pages/Verify'

export default function App() {
  return (
    <div className="min-h-screen font-sans text-slate-900">
      <AnimatedBackground />
      <header className="mx-auto max-w-md px-4 pb-6 pt-10 text-white">
        <div className="inline-block rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
          <img src="/logo.png" alt="TrustCert" className="h-12 w-auto" />
        </div>
        <p className="mt-3 font-display text-sm uppercase tracking-[0.2em] text-teal-300">In Cert We Trust</p>
        <p className="mt-2 text-sm text-slate-300">Verify a Kenyan university certificate in seconds. No login.</p>
      </header>
      <main className="mx-auto max-w-md px-4">
        <div className="rounded-3xl bg-white/95 p-4 shadow-2xl backdrop-blur">
          <Verify />
        </div>
      </main>
      <footer className="mx-auto max-w-md p-4 text-xs text-slate-400">
        The blockchain proves a record was not changed after it was anchored. AI output is a risk signal, never proof.
      </footer>
    </div>
  )
}
