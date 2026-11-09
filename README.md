# FISI-Prüfungstrainer

Lern-Web-App (PWA) für die **IHK-Abschlussprüfung Teil 2 – Fachinformatiker/-in Systemintegration** (AO 2020).
Läuft auf Handy und PC, ist installierbar und offline nutzbar. Alle Daten bleiben lokal im Browser (IndexedDB) – kein Login, kein Server.

**Live:** https://fisi-pruefung.netlify.app

## Funktionen

**Lernen**
- **Fragenpool mit 515 Karten** (KA 181 · NET 170 · WiSo 108 · Projekt 56), eigene Formulierungen im IHK-Stil; Jahreswerte (Mindestlohn, Beitragssätze …) mit Tag `jahreswert` und Stand
- **Karteikarten mit Spaced Repetition** (FSRS über `ts-fsrs`), Bewertung Nochmal / Schwer / Gut / Einfach
- Startseite „Heute“: fällige und neue Karten (Limit einstellbar), geschätzte Lernzeit, Lern-Serie
- Lernmodus mit Tastenkürzeln (Leertaste = aufdecken, 1–4 = bewerten, S = Stern, Esc = beenden) und Wischgesten (← Nochmal, Gut →)
- Kartentypen: Frage/Antwort, Lückentext, Multiple Choice, Reihenfolge, Vergleich
- Filter nach Bereich, Thema, Schwierigkeit, Prüfungsrelevanz, „nur schwache Karten“, markierte Karten, Volltextsuche; freies Üben ohne Planung
- **Prüfungsendspurt:** Prüfungsdatum eintragen → Countdown; in den letzten 60 Tagen werden prüfungsrelevante Karten und Themen mit schlechter Quote stärker gewichtet
- Stern, eigene Notiz, „Karte als fehlerhaft melden“ (Liste exportierbar)

**Rechnen** – 8 Rechen-Trainer, je 3 Stufen, unendlich viele seed-basierte Zufallsaufgaben mit ausführlichem Rechenweg, Trefferquote und Zeit:
IPv4-Subnetting (inkl. VLSM) · IPv6 (Kürzen, Präfixe, n-tes Subnetz, EUI-64) · Zahlensysteme · RAID & Speicher (GB/GiB) · Übertragung & Datenmengen · Backup · Verfügbarkeit & USV · Wirtschaftlichkeit (Nutzwertanalyse, Break-even, Amortisation, Stromkosten, Netzplan)

**Prüfung trainieren**
- **WiSo-Test:** Multiple-Choice-Runden mit 10/20/30 Fragen, sofortige oder gesammelte Auswertung mit Erklärung; **Simulation** mit 30 Fragen in 60 Minuten; falsche Fragen per Klick markieren
- **Prüfungssimulation KA/NET:** zufällige offene Aufgaben + Rechenaufgaben, 90 (oder 45) Minuten mit Timer, Selbstbewertung nach Musterlösung oder KI-Bewertung, Ergebnis in Punkten und IHK-Note; Zwischenstand bleibt beim Neuladen erhalten
- **Notenrechner:** Punkte je Prüfungsteil + AP1 → Gesamtergebnis, Note, Prüfung aller Bestehensregeln und Empfehlung zur mündlichen Ergänzungsprüfung (welcher Bereich, wie viele Punkte nötig)
- **Projekt-Checkliste:** Antrag, Durchführung, Doku-Gliederung, Formalia, Präsentation, Fachgespräch

**KI-Tutor (optional, Claude API):** „Erklär mir das“ an jeder Karte und jedem Rechenweg (mit Rückfragen), offene Antworten wie ein IHK-Prüfer bewerten lassen, neue Übungsaufgaben generieren und als Karte speichern, Fachgespräch-Simulator mit Timer und Notentendenz, Präsentations-Coach

**Statistik:** Lernzeit, gelernte Karten, Quote (30 Tage), Heatmap-Kalender der letzten 26 Wochen, Quote je Prüfungsbereich und Thema, Top 10 schwächste Themen (mit „üben“-Link), Rechen-Trainer-Auswertung, Test- und Simulationsergebnisse

**Allgemein:** installierbar und offline nutzbar (PWA), Dark Mode (Schnellumschalter System → Hell → Dunkel), Markdown mit Tabellen und Syntax-Highlighting, **Backup** als JSON (zusammenführen oder ersetzen) für den Wechsel Handy ↔ PC

## Prüfungsrahmen (in der App abgebildet)

| Prüfungsteil | Gewicht |
|---|---|
| AP Teil 1 | 20 % |
| Projekt: Dokumentation / Präsentation / Fachgespräch | 25 % / 12,5 % / 12,5 % |
| Konzeption und Administration von IT-Systemen | 10 % |
| Analyse und Entwicklung von Netzwerken | 10 % |
| Wirtschafts- und Sozialkunde | 10 % |

Bestanden, wenn Gesamtergebnis ≥ 50, Teil 2 ≥ 50, mindestens 3 Bereiche von Teil 2 ≥ 50 und kein Bereich von Teil 2 unter 30 Punkten. Mündliche Ergänzungsprüfung in einem schriftlichen Bereich unter 50 Punkten möglich (Gewichtung schriftlich : mündlich = 2 : 1). IHK-Notenschlüssel: ab 92 = 1, ab 81 = 2, ab 67 = 3, ab 50 = 4, ab 30 = 5, darunter 6. **Vorgaben der eigenen IHK haben Vorrang.**

## Entwicklung

Voraussetzung: Node.js ≥ 20.

```bash
npm install        # .npmrc setzt legacy-peer-deps (umgeht einen npm-Bug bei optionalen Peer-Dependencies)
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Vitest: Rechen-Generatoren gegen unabhängige Referenzen, Notenrechner/Bestehensregeln, FSRS, Statistik, KI-Client (gemockt), Backup, Inhalte
npm run validate   # nur Inhalte gegen das Zod-Schema prüfen
npm run build      # validieren + Typecheck + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

## KI-Tutor (Claude API)

- Einschalten unter **Einstellungen → KI-Tutor**, eigenen Anthropic-API-Key eintragen (console.anthropic.com, am besten mit Ausgabenlimit). Ohne Key ist die App voll nutzbar.
- Der Key liegt **nur lokal** im Browser (IndexedDB) und wird **nicht** exportiert. Die App ruft die API direkt aus dem Browser auf (offizielles SDK `@anthropic-ai/sdk` mit `dangerouslyAllowBrowser`, Header `anthropic-dangerous-direct-browser-access`).
- Standardmodell `claude-sonnet-5-5`, frei änderbar. Bei Sonnet 5.5/Opus 5.5 ist der serverseitige Fallback bei Ablehnungen aktiviert (`fallbacks: "default"`).
- Eigener **Proxy** möglich: Basis-URL in den Einstellungen ändern. Der Proxy muss die Messages-API (`POST /v1/messages`, Streaming/SSE) durchreichen und kann den Key serverseitig setzen; das SDK sendet einen evtl. eingetragenen Key als `Authorization: Bearer …`.
- Code: `src/ai/aiClient.ts` (API-Zugriff, Fehlermeldungen), `src/ai/prompts.ts` (System-Prompts), `src/ai/config.ts`.

## Rechen-Trainer erweitern

Jeder Trainer liegt in `src/trainers/<name>.ts` und besteht aus Aufgabentypen mit einer Funktion `gen(rng, level)`, die Aufgabentext, Eingabefelder (mit Typ und Toleranz) und den Rechenweg als Markdown liefert. Aufgaben sind über den Seed reproduzierbar (`#/rechnen/subnetting?typ=vlsm&seed=123`).
Die Tests (`*.test.ts`) rechnen jede Aufgabe über einen **unabhängigen Weg** nach, z. B. Subnetting über Oktett-Arithmetik statt Bitmasken, IPv6 über den URL-Parser von Node, Netzpläne über die Aufzählung aller Pfade und Verfügbarkeit per Monte-Carlo-Simulation.

## Projektstruktur

```
src/
  app/        Layout, Routing (HashRouter)
  pages/      Heute, Karten, Lernen, Rechnen, KI, Statistik, WiSo, Simulation, Notenrechner, Checkliste, Einstellungen
  components/ Kartenansicht, Markdown, Chat, UI-Bausteine
  content/    Fragenpool als JSON (ka/, net/, wiso/, proj/), Zod-Schema, Checkliste
  db/         Dexie/IndexedDB, Einstellungen, Backup
  srs/        FSRS-Wrapper, Warteschlange/Endspurt, Filter
  trainers/   Rechen-Trainer (Generatoren + Rechenwege + Tests)
  grading/    IHK-Notenschlüssel, Bestehensregeln, Ergänzungsprüfung
  stats/      Statistik-Berechnungen
  ai/         Claude-API-Client, System-Prompts
scripts/      Inhaltsvalidierung
```

## Eigene Karten ergänzen

Inhalte liegen als JSON in `src/content/<bereich>/<thema>.json` (`ka`, `net`, `wiso`, `proj`):

```json
{
  "area": "NET",
  "topic": "IPv6",
  "cards": [
    {
      "id": "net-ipv6-slaac-02",
      "type": "qa",
      "front": "Frage (Markdown erlaubt)",
      "back": "Musterlösung im IHK-Stil",
      "difficulty": 2,
      "examRelevance": "hoch"
    }
  ]
}
```

- `id`: stabil und eindeutig, Präfix = Bereich (`net-…-01`). Nie ändern, sonst geht der Lernstand der Karte verloren.
- `type`: `qa` · `cloze` (Lücken als `{{Lösung}}` in `front`) · `mc` (`choices` + `correct` als 0-basierte Indizes, optional `explanation`) · `order` (`choices` in **richtiger** Reihenfolge, die App mischt) · `compare`
- optional: `points`, `tags`, `asOf` (Pflicht bei Tag `jahreswert`, z. B. `"2026-01"`)

`npm run validate` (läuft auch bei jedem Build und in den Tests) prüft Schema, doppelte IDs und doppelte Fragen.

## Deployment

Der Build ist **pfadunabhängig** (relative Pfade + Hash-Routing) und läuft ohne Rewrite-Regeln überall:

- **CI:** `.github/workflows/ci.yml` führt bei jedem Push Tests und Build aus (kein Deployment).
- **GitHub Pages** (optional): `dist/` z. B. mit `actions/upload-pages-artifact` + `actions/deploy-pages` veröffentlichen.
- **Netlify:** `netlify.toml` legt Build-Befehl (`npm run build`), Publish-Verzeichnis (`dist`), Node-Version und Cache-Header fest (Service Worker/`index.html` ohne Cache, gehashte Assets langfristig).
- **Apache / beliebiger Webserver:** Inhalt von `dist/` in ein beliebiges (Unter-)Verzeichnis kopieren. Für die PWA-Installation ist HTTPS nötig (Ausnahme: `localhost`).

## Hinweise

- Inhalte sind eigene Formulierungen im IHK-Stil, keine Originalaufgaben. Angaben ohne Gewähr – **die Vorgaben deiner IHK haben Vorrang.**
- Jahresabhängige Werte (Beitragssätze, Mindestlohn …) sind mit dem Tag `jahreswert` und dem Stand gekennzeichnet.
