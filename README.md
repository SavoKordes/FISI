# FISI-Prüfungstrainer

Lern-Web-App (PWA) für die **IHK-Abschlussprüfung Teil 2 – Fachinformatiker/-in Systemintegration** (AO 2020).
Läuft auf Handy und PC, ist installierbar und offline nutzbar. Alle Daten bleiben lokal im Browser (IndexedDB) – kein Login, kein Server.

**Live:** https://fisi-pruefung.netlify.app

## Funktionen (Stand: Meilenstein 3)

- **Fragenpool mit 515 Karten** (KA 181 · NET 170 · WiSo 108 · Projekt 56), eigene Formulierungen im IHK-Stil, Jahreswerte mit Stand gekennzeichnet
- **Karteikarten mit Spaced Repetition** (FSRS über `ts-fsrs`), Bewertung Nochmal / Schwer / Gut / Einfach
- Startseite „Heute“: fällige Karten, neue Karten pro Tag (einstellbar), geschätzte Lernzeit, Lern-Serie
- Lernmodus mit Tastenkürzeln (Leertaste = aufdecken, 1–4 = bewerten, S = Stern, Esc = beenden) und Wischgesten (← Nochmal, Gut →)
- Kartentypen: Frage/Antwort, Lückentext, Multiple Choice, Reihenfolge, Vergleich
- Filter nach Bereich, Thema, Schwierigkeit, Prüfungsrelevanz, „nur schwache Karten“, markierte Karten, Volltextsuche
- **Prüfungsendspurt:** Prüfungsdatum eintragen → Countdown; in den letzten 60 Tagen werden prüfungsrelevante Karten und Themen mit schlechter Quote stärker gewichtet
- Stern, eigene Notiz, „Karte als fehlerhaft melden“ (Liste exportierbar)
- **Backup**: Export/Import als JSON (zusammenführen oder ersetzen) – auch für den Wechsel Handy ↔ PC
- Dark Mode (Schnellumschalter System → Hell → Dunkel in Kopfzeile/Sidebar), Markdown mit Tabellen und Syntax-Highlighting
- **Rechen-Trainer** (8 Trainer, je 3 Stufen, unendlich viele seed-basierte Zufallsaufgaben, ausführlicher Rechenweg, Trefferquote und Zeit):
  IPv4-Subnetting (inkl. VLSM) · IPv6 (Kürzen, Präfixe, n-tes Subnetz, EUI-64) · Zahlensysteme · RAID & Speicher (GB/GiB) ·
  Übertragung & Datenmengen · Backup · Verfügbarkeit & USV · Wirtschaftlichkeit (Nutzwertanalyse, Break-even, Amortisation, Stromkosten, Netzplan)

Folgt: KI-Tutor (M4), WiSo-Modus, Simulation, Notenrechner, Statistik, Projekt-Checkliste (M5).

## Entwicklung

Voraussetzung: Node.js ≥ 20.

```bash
npm install        # .npmrc setzt legacy-peer-deps (umgeht einen npm-Bug bei optionalen Peer-Dependencies)
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test           # Vitest (Rechen-Generatoren gegen unabhängige Referenzen, FSRS, Warteschlange, Backup, Inhalte)
npm run validate   # nur Inhalte gegen das Zod-Schema prüfen
npm run build      # validieren + Typecheck + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

## Rechen-Trainer erweitern

Jeder Trainer liegt in `src/trainers/<name>.ts` und besteht aus Aufgabentypen mit einer Funktion `gen(rng, level)`, die Aufgabentext, Eingabefelder (mit Typ und Toleranz) und den Rechenweg als Markdown liefert. Aufgaben sind über den Seed reproduzierbar (`#/rechnen/subnetting?typ=vlsm&seed=123`).
Die Tests (`*.test.ts`) rechnen jede Aufgabe über einen **unabhängigen Weg** nach, z. B. Subnetting über Oktett-Arithmetik statt Bitmasken, IPv6 über den URL-Parser von Node, Netzpläne über die Aufzählung aller Pfade und Verfügbarkeit per Monte-Carlo-Simulation.

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
