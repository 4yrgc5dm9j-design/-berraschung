# Dailybase

Deine persönliche Alltagszentrale: **Heute** (Dashboard), **Entdecken** (News, Börse, Sport), **Sammlungen** (Links, Reels, Ideen), **Planen** (Aufgaben, Kalender, Notizen, Lernen, Fokus, Gewohnheiten, Einkauf, Finanzen) und **Profil**. Responsive Web-App, installierbar als PWA, komplett auf Deutsch.

## Starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev        # Entwicklung: App auf http://localhost:5173 (+ API-Server auf :8787)
```

Fürs iPhone im selben WLAN: die im Terminal angezeigte „Network“-Adresse öffnen.

Produktiv / dauerhaft:

```bash
npm run build
npm start          # liefert App + API auf http://localhost:8787
```

> Als PWA (Homescreen, offline) braucht die App HTTPS – z. B. über einen Hoster wie Render/Fly.io oder einen eigenen Server mit Zertifikat. Lokal funktioniert alles auch ohne.

### Optionale Schlüssel

`.env.example` nach `.env` kopieren. Aktuell optional: `FINNHUB_API_KEY` für Live-Börsenkurse (kostenloser Plan). Schlüssel bleiben auf dem Server und werden nie an den Browser ausgeliefert.

## Technik

| Teil | Wahl | Warum |
|---|---|---|
| Oberfläche | React 19 + TypeScript + Vite | verbreitet, schnell, gut wartbar |
| Design | Tailwind CSS 4, eigene Design-Tokens, Bricolage Grotesque + Manrope | Hell/Dunkel + 6 Akzentfarben über CSS-Variablen |
| Zustand & Speicher | Zustand + IndexedDB (mit synchroner localStorage-Kopie) | überlebt Neustarts, verträgt Bilder; Speicher-Adapter austauschbar für späteres Backend |
| Server | Node ohne Abhängigkeiten (`server/`) | News-Feeds (CORS), Link-Vorschauen mit SSRF-Schutz, Kurse mit geheimem Schlüssel |
| Tests | Vitest (Logik) + Playwright (Abläufe, Smartphone & Desktop) | `npm test`, `npm run test:e2e` |

Alle Einträge haben `id`, `createdAt`, `updatedAt` – vorbereitet für Konten und Synchronisation.

## Datenquellen

| Bereich | Quelle | Kosten | Grenzen |
|---|---|---|---|
| Wetter | Open-Meteo | frei, ohne Schlüssel | nicht-kommerzielle Nutzung |
| Fußball | OpenLigaDB | frei, ohne Schlüssel | Community-gepflegt, 1.–3. Liga |
| News | öffentliche RSS-Feeds (tagesschau, Spiegel, heise, golem, sportschau, kicker) | frei | nur Titel/Anriss, Link zum Original |
| Börse | Finnhub (optional) | kostenloser Plan | v. a. US-Werte in USD; sonst manuelle Kurse in € |
| Link-Vorschau | YouTube oEmbed, OpenGraph-Daten | frei | Instagram nur mit Meta-App (nicht eingebunden) |

Es werden keine Live-Daten erfunden. Echte Daten zeigen Quelle und Aktualisierungszeit; offline erscheint der letzte Stand mit Hinweis.

## Instagram – was offiziell geht

- ✅ Instagram aus Schnellzugriff/Sammlung öffnen (öffnet die App), Reel-/Beitrags-Links speichern, mit Notizen, Tags, Bewertung, Screenshot.
- ✅ Android/Chrome: installierte App erscheint im Teilen-Menü (Web Share Target → `/teilen`).
- ✅ iPhone: Kurzbefehl „URL öffnen“ → `https://<deine-adresse>/teilen?url=<Eingabe>`.
- ❌ Privater Feed, Stories, Direktnachrichten: keine offizielle Schnittstelle für Privatkonten (Basic Display API seit Ende 2024 eingestellt).
- ⏳ Vorschaubilder für Reels: nur über Meta-oEmbed mit registrierter, geprüfter App – später optional.

## Ausbaustufen

1. ✅ Grundversion: Navigation, Dashboard mit 3 Ansichten & anpassbaren Widgets, Aufgaben, Notizen, Sammlungen, Schnellzugriffe, Einstellungen, Export/Import, Rückgängig.
2. ✅ Module: Kalender & Prüfungen, Lernkarten, Fokus-Timer, Gewohnheiten, Einkaufslisten, Ausgaben & Sparziele, News, Börse (Watchlist, Depot, Sparplanrechner, Spieldepot), Sport, globale Suche.
3. ⏳ Geplant: Benutzerkonto & Sync, gemeinsame Sammlungen, Tippspiel, KI-Zusammenfassungen, historische Kurse, Instagram-oEmbed.
