import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Link, navigate } from '../router'
import { outlineButton } from '../ui'

const parse = (text: string) => {
  const m = text.match(/\/verify\/(\d+)\/([^/?#\s]+)/)
  return m ? `/verify/${m[1]}/${m[2]}` : null
}

export default function Scan() {
  const [error, setError] = useState('')

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    const started = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          const to = parse(text)
          if (to) navigate(to)
          else setError('This is not a TrustCert QR code.')
        },
        () => {},
      )
      .catch(() => setError('The camera could not be opened. Allow camera access, or enter the serial number instead.'))
    return () => { started.then(() => scanner.stop()).then(() => scanner.clear()).catch(() => {}) }
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-navy-900">Scan the QR code</h2>
      <div id="qr-reader" className="min-h-72 overflow-hidden rounded-2xl bg-navy-950" />
      <p className="text-center text-sm text-slate-600">Point your camera at the QR code printed on the certificate.</p>
      {error && <p className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
      <Link to="/" className={outlineButton}>Enter serial number instead</Link>
    </div>
  )
}
