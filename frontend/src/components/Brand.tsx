export function Shield({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 40) / 36} viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <path d="M18 2L32 7v11c0 9-6 16-14 20C10 34 4 27 4 18V7L18 2z" fill="#1B3A78" stroke="#5EDAD0" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 20l5 5 9-10" stroke="#5EDAD0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-display ${className}`}>Trust<span className="text-teal-300">Cert</span></span>
}
