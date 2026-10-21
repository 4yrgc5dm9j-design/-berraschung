import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ItemEditor } from './ItemEditor'
import { firstUrlIn } from '@/lib/links'

/**
 * Empfängt geteilte Links:
 * - Android/Chrome: über das Web-Share-Target im Manifest
 * - iPhone: über einen Kurzbefehl, der /teilen?url=… öffnet
 */
export default function SharePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const raw = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')
  const url = firstUrlIn(raw) ?? params.get('url') ?? ''
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (!open) navigate('/sammlungen', { replace: true })
  }, [open, navigate])
  return <ItemEditor open={open} initialUrl={url} onClose={() => setOpen(false)} />
}
