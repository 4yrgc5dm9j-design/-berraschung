import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui'
import { QuickIcon } from '@/components/ui/LinkIcon'
import { cn } from '@/lib/utils'

/** Ehrliche Übersicht, was mit Instagram offiziell geht – und was nicht. */
export function InstagramInfo() {
  const [open, setOpen] = useState(false)
  return (
    <section className="card mt-8 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 p-4 text-left" aria-expanded={open}>
        <QuickIcon icon="instagram" />
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">Instagram & Dailybase</h2>
          <p className="text-sm text-muted">Was offiziell möglich ist – ohne Tricks oder Scraping.</p>
        </div>
        <ChevronDown className={cn('size-5 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-line p-4 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold text-success">Funktioniert jetzt</p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              <li>Instagram aus den Schnellzugriffen öffnen – auf dem iPhone öffnet sich die Instagram-App.</li>
              <li>Reels- und Beitrags-Links speichern: In Instagram „Teilen → Link kopieren“, dann in Dailybase einfügen (Knopf „Aus Zwischenablage“).</li>
              <li>Gespeicherte Links öffnen direkt in Instagram.</li>
              <li>
                Android/Chrome: Dailybase als App installieren, dann erscheint sie im Teilen-Menü von Instagram <Badge tone="accent">Teilen-Ziel</Badge>
              </li>
              <li>
                iPhone-Tipp: Kurzbefehl anlegen („Im Share-Sheet anzeigen“) mit der Aktion „URL öffnen“: <code className="break-all">{location.origin}{import.meta.env.BASE_URL}teilen?url=</code> + Kurzbefehleingabe. Dann landet ein Reel mit zwei Tipps in Dailybase.
              </li>
              <li>Eigene Notizen, Bewertungen, Tags und Screenshots zu jedem Link.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-warn">Offiziell nicht möglich</p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              <li>Privater Feed, Stories oder Direktnachrichten: Meta bietet dafür keine Schnittstelle für Privatkonten an (die „Basic Display API“ wurde Ende 2024 eingestellt).</li>
              <li>Automatische Vorschaubilder für Reels: nur über die Meta-oEmbed-API mit registrierter, geprüfter App und Zugangsschlüssel. <Badge tone="planned">Optional später</Badge></li>
              <li>iPhone: Web-Apps können nicht im Teilen-Menü erscheinen.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
