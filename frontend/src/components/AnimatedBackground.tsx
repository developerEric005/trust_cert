import { useEffect, useRef } from 'react'

// Slow-drifting "trust network" on Midnight Navy. Light on CPU: ~40-70 dots,
// pauses when the tab is hidden, and stays still if the user prefers reduced motion.
export default function AnimatedBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    type P = { x: number; y: number; vx: number; vy: number }
    let w = 0, h = 0, raf = 0, pts: P[] = []

    const resize = () => {
      const widthChanged = window.innerWidth !== w
      w = window.innerWidth; h = window.innerHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!pts.length || widthChanged) {
        const n = Math.round(Math.min(70, (w * h) / 16000))
        pts = Array.from({ length: n }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        }))
      }
    }

    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#040F2E'); g.addColorStop(0.6, '#061D4A'); g.addColorStop(1, '#0A2F5C')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

      const t = performance.now() / 1000 // slow teal glow that drifts
      const gx = w * (0.3 + 0.2 * Math.sin(t / 9)), gy = h * (0.25 + 0.1 * Math.cos(t / 11))
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6)
      rg.addColorStop(0, 'rgba(10,163,154,0.22)'); rg.addColorStop(1, 'rgba(10,163,154,0)')
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h)

      const D = 130
      if (!reduce) for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
          if (d < D) {
            ctx.strokeStyle = `rgba(94,218,208,${0.18 * (1 - d / D)})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
          }
        }
        ctx.fillStyle = 'rgba(94,218,208,0.55)'
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
    }

    const loop = () => { draw(); raf = requestAnimationFrame(loop) }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) loop() }

    resize(); draw()
    if (!reduce) loop()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 -z-10" />
}
